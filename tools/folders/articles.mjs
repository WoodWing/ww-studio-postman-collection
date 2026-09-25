// "Digital Articles" and "Print Articles" folders: step-by-step flows for creating an article from a file you
// upload yourself. They run against your own brand, set in the environment (Publication_Id, Section_Id, Status_Id).
import { folder, httpRequest, newGuid, RPC_TEST, rpcBuilder, s, TRANSFER_URL } from '../lib/postman.mjs';

const rpc = rpcBuilder('wfl', 'Current_Ticket');

const TRANSFER = `${TRANSFER_URL}?ticket={{Current_Ticket}}&fileguid={{Uuid_For_PUT}}`;

function supportingRequests(format) {
    return folder('Supporting Requests', [
        httpRequest('Upload Transfer Server Request', 'PUT', TRANSFER, {
            body: { mode: 'file', file: {} },
            description: 'Uploads the article file to the Transfer Server. **Select your own file in the Body tab before sending.** The pre-request script generates the file GUID in `Uuid_For_PUT`; CreateObjects refers to it in `Files[].FileUrl`.',
            prerequest: newGuid('Uuid_For_PUT').replace("pm.collectionVariables.set('Uuid_For_PUT'", "pm.environment.set('Uuid_For_PUT'"),
        }),
        httpRequest('Download Transfer Server Request', 'GET', `${TRANSFER}&format=${format}`, {
            description: 'Downloads the uploaded file again (for checking the upload).',
        }),
        httpRequest('Delete Transfer Server Request', 'DELETE', TRANSFER, {
            description: 'Removes the uploaded file from the Transfer Server. Not needed after CreateObjects, which consumes the file.',
        }),
    ]);
}

// Publication, Category and State are identified by Id; the server does not need the Name.
const basicMetaData = (name, type) => ({
    Name: name,
    Type: type,
    Publication: { Id: s('Publication_Id'), Name: '', __classname__: 'Publication' },
    Category: { Id: s('Section_Id'), Name: '', __classname__: 'Category' },
    __classname__: 'BasicMetaData',
});
const workflowMetaData = {
    Comment: 'Created with Postman',
    State: { Id: s('Status_Id'), Name: '', Type: 'Article', __classname__: 'State' },
    __classname__: 'WorkflowMetaData',
};
const file = format => [{
    Rendition: 'native',
    Type: format,
    FileUrl: `${TRANSFER_URL}?fileguid={{Uuid_For_PUT}}`,
    __classname__: 'Attachment',
}];

const DIGITAL = 'application/ww-digital+json';
const WCML = 'application/incopyicml';

export const digitalArticles = folder('Digital Articles', [
    supportingRequests(DIGITAL),
    rpc('QueryObjects Digital Article Templates', 'QueryObjects', {
        Params: [{ Property: 'Type', Operation: '=', Value: 'ArticleTemplate', __classname__: 'QueryParam' }],
        Hierarchical: false,
        MinimalProps: ['ID', 'Type', 'Name'],
        RequestProps: ['ID', 'Type', 'Name', 'Format', 'PublicationId'],
    }, { description: 'Finds the article templates, for example to pick a digital article template to base the upload on.' }),
    rpc('CreateObjects Digital Article', 'CreateObjects', {
        Lock: false,
        Objects: [{
            MetaData: {
                BasicMetaData: basicMetaData('Postman digital article', 'Article'),
                WorkflowMetaData: workflowMetaData,
                ContentMetaData: { Format: DIGITAL, __classname__: 'ContentMetaData' },
                ExtraMetaData: [
                    { Property: 'C_CS_FILEFORMATVERSION', Values: ['2.4'], __classname__: 'ExtraMetaData' },
                    { Property: 'C_CS_COMPONENTSET', Values: [s('Component_Set_Id')], __classname__: 'ExtraMetaData' },
                ],
                __classname__: 'MetaData',
            },
            Files: file(DIGITAL),
            __classname__: 'Object',
        }],
    }, {
        description: 'Creates a digital article from the uploaded `application/ww-digital+json` file. `C_CS_COMPONENTSET` must be the ID of a component set installed on your server (`Component_Set_Id` in the environment); `C_CS_FILEFORMATVERSION` must match the file.',
    }),
], {
    description: 'A series of calls for creating digital articles within Studio: upload the article JSON to the Transfer Server, then create the article from it. Uses `Publication_Id`, `Section_Id`, `Status_Id` and `Component_Set_Id` from the environment.',
    test: RPC_TEST,
});

const ELEMENTS = ['Body', 'Caption', 'Credit', 'Crosshead', 'Footer', 'Graphic', 'Head', 'Highlight', 'Subhead'];

export const printArticles = folder('Print Articles', [
    supportingRequests(WCML),
    rpc('CreateObjects Print Article', 'CreateObjects', {
        Lock: false,
        Objects: [{
            MetaData: {
                BasicMetaData: basicMetaData('Postman print article', 'Article'),
                WorkflowMetaData: workflowMetaData,
                ContentMetaData: { Format: WCML, __classname__: 'ContentMetaData' },
                __classname__: 'MetaData',
            },
            Files: file(WCML),
            Elements: ELEMENTS.map(name => ({
                ID: '{{$guid}}',
                Name: name,
                LengthWords: 7,
                LengthChars: 33,
                LengthParas: 1,
                LengthLines: 1,
                Snippet: `This is the ${name.toLowerCase()} of the article`,
                Version: '1',
                Content: `This is the ${name.toLowerCase()} of the article`,
                __classname__: 'Element',
            })),
            __classname__: 'Object',
        }],
        ReplaceGUIDs: true,
    }, {
        description: 'Creates an InCopy (WCML) article from the uploaded file. `Elements` describe the text components of the article; with `ReplaceGUIDs: true` the server gives the article and its elements new GUIDs.',
    }),
], {
    description: 'A series of calls for creating print (InCopy WCML) articles within Studio. Uses `Publication_Id`, `Section_Id` and `Status_Id` from the environment.',
    test: RPC_TEST,
});
