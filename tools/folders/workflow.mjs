// Workflow (index.php) folder: one request per Workflow service, laid out as a runnable test cycle on a throw-away
// brand. Calls that need server configuration or objects you already have are in "Samples" sub-folders and are
// skipped until you set the Wfl_* variables they use.
import {
    capture, captureExpr, expectEquals, expectIdIn, expectIncludes, expectProp, folder, GUARD_PREREQUEST, httpRequest, n, newGuid, RPC_TEST,
    rpcBuilder, s, storeTicket, TRANSFER_URL,
} from '../lib/postman.mjs';
import { fixtureNames, fixtureSetup, fixtureTeardown, statusVar } from './fixtures.mjs';

const P = 'Wfl';
const rpc = rpcBuilder('wfl', 'Current_Ticket');
const N = fixtureNames(P, 'Workflow');
const TAG = s('Wfl_Run_Tag');

// Collection variables used by the optional samples. Leave empty to skip those samples.
export const variables = {
    Wfl_Run_Tag: '',
    Wfl_NamedQuery: '',
    Wfl_Run_UpdateObjectLabels: '',
    Wfl_WebApp_Url: '',
    Wfl_Native_App_Protocol: '',
    Wfl_Code_Challenge: '',
    Wfl_Tenant_Auth_Token: '',
    Wfl_AI_Prompt_Type: '',
    Wfl_Spelling_Language: '',
    Wfl_Autocomplete_Provider: '',
    Wfl_Autocomplete_Property: '',
    Wfl_Autocomplete_Entity: '',
    Wfl_Suggestion_Provider: '',
    Wfl_External_Property: '',
    Wfl_Custom_Property: '',
    Wfl_Template_Id: '',
    Wfl_Layout_Id: '',
    Wfl_Layout_Version: '',
    Wfl_Place_Dossier_Id: '',
    Wfl_Place_Article_Id: '',
    Wfl_Place_Digital_Article_Id: '',
    Wfl_Place_Image_Id: '',
    Wfl_InDesignArticle_Id: '',
    Wfl_Element_Id: '',
    Wfl_Spline_Id: '',
    Wfl_ConversionRuleSet_Id: '',
    Wfl_Wcml_Article_Id: '',
    Wfl_New_Password: '',
    Transfer_Guid: '',
};

// ---- Data helpers (Workflow IDs are strings) ------------------------------------------------------------------------

const publication = { Id: s('Wfl_Pub_Id'), Name: N.brand, __classname__: 'Publication' };
const category = { Id: s('Wfl_Section_Id'), Name: N.section, __classname__: 'Category' };
const state = (type, i = 0) => ({ Id: s(statusVar(P, type, i)), Name: N.status(type, i), Type: type, __classname__: 'State' });
const target = (issueVar = 'Wfl_Issue_Id', issueName = N.issue, extra = {}) => ({
    PubChannel: { Id: s('Wfl_Channel_Id'), Name: N.channel, __classname__: 'PubChannel' },
    Issue: { Id: s(issueVar), Name: issueName, OverrulePublication: false, __classname__: 'Issue' },
    ...extra,
    __classname__: 'Target',
});
const metaData = (name, type, { format, comment = 'Created by the Postman Workflow test run', id, stateIndex = 0 } = {}) => ({
    BasicMetaData: {
        ...(id ? { ID: id } : {}),
        Name: name,
        Type: type,
        Publication: publication,
        Category: category,
        __classname__: 'BasicMetaData',
    },
    WorkflowMetaData: { Comment: comment, State: state(type, stateIndex), __classname__: 'WorkflowMetaData' },
    ...(format ? { ContentMetaData: { Format: format, __classname__: 'ContentMetaData' } } : {}),
    __classname__: 'MetaData',
});
const textFile = () => [{
    Rendition: 'native',
    Type: 'text/plain',
    FileUrl: `${TRANSFER_URL}?fileguid={{Transfer_Guid}}`,
    __classname__: 'Attachment',
}];
const metaValue = (property, values) => ({ Property: property, Values: values, __classname__: 'MetaDataValue' });
const queryParam = (property, operation, value) => ({ Property: property, Operation: operation, Value: value, __classname__: 'QueryParam' });
const relation = (parent, child, type, extra = {}) => ({ Parent: s(parent), ...(child ? { Child: s(child) } : {}), Type: type, ...extra, __classname__: 'Relation' });
const label = id => ({ Id: n(id), __classname__: 'ObjectLabel' });

const objectId = 'result.Objects[0].MetaData.BasicMetaData.ID';

function upload(name, content) {
    return httpRequest(name, 'PUT', `${TRANSFER_URL}?ticket={{Current_Ticket}}&fileguid={{Transfer_Guid}}`, {
        header: [{ key: 'Content-Type', value: 'text/plain' }],
        body: { mode: 'raw', raw: content },
        description: 'Uploads a small plain text file to the Transfer Server. The pre-request script generates the file GUID in `Transfer_Guid`; the next Create/Save call refers to it in `Files[].FileUrl`.',
        prerequest: newGuid('Transfer_Guid'),
    });
}

// Asserts that QueryObjects/NamedQuery rows contain the object ID in the "ID" column.
const expectRowsInclude = varName => `
pm.test('Rows contain {{${varName}}}', () => {
    const result = pm.response.json().result || {};
    const col = (result.Columns || []).findIndex(c => c.Name === 'ID');
    pm.expect(col, 'ID column').to.be.at.least(0);
    pm.expect((result.Rows || []).map(r => String(r[col]))).to.include(String(pm.collectionVariables.get('${varName}')));
});`;

// ---- 01 Session and server --------------------------------------------------------------------------------------

const session = folder('01 Session and server', [
    rpc('GetServers', 'GetServers', {}, {
        description: 'Lists the servers this entry point knows. Does not need a ticket; clients call it before LogOn.',
        test: `pm.test('Servers is an array', () => pm.expect(pm.response.json().result.Servers).to.be.an('array'));`,
    }),
    rpc('LogOn', 'LogOn', {
        User: s('User_Name'),
        Password: s('Password'),
        ClientName: 'postman',
        ClientAppName: 'postman_sample_requests',
        ClientAppVersion: '1.0',
        RequestInfo: ['ServerInfo', 'CurrentUser'],
    }, {
        ticket: false,
        description: 'Logs on as {{User_Name}}. The test script stores the ticket in the `Current_Ticket` environment variable.\n\n`RequestInfo` selects what LogOn returns besides the ticket, e.g. `Publications`, `NamedQueries`, `ServerInfo`, `Settings`, `Users`, `UserGroups`, `Membership`, `ObjectTypeProperties`, `ActionProperties`, `Terms`, `FeatureProfiles`, `Messages`, `CurrentUser`, `MessageQueueConnections`. Leave it out to get everything (slow).',
        test: storeTicket('Current_Ticket'),
    }),
    rpc('CheckTicket', 'CheckTicket', {}, {
        test: `pm.test('TicketHash returned', () => pm.expect(pm.response.json().result.TicketHash).to.be.a('string').and.not.empty);`,
    }),
    rpc('GetServerInfo', 'GetServerInfo', {}, {
        test: `pm.test('ServerInfo.Version returned', () => pm.expect(pm.response.json().result.ServerInfo.Version).to.be.a('string'));`,
    }),
]);

// ---- 02 User profile and settings ----------------------------------------------------------------------------------

const SETTING = `PM_Test_${TAG}`;
const userAndSettings = folder('02 User profile and settings', [
    rpc('GetUserProfile', 'GetUserProfile', { RequestInfo: ['Memberships'] }, {
        test: `pm.test('CurrentUser is {{User_Name}}', () => {
    const user = pm.response.json().result.CurrentUser || {};
    pm.expect(String(user.UserID).toLowerCase()).to.eql(String(pm.variables.get('User_Name')).toLowerCase());
});`,
    }),
    rpc('GetUsers', 'GetUsers', { Params: [queryParam('UserID', '=', s('User_Name'))] }, {
        description: 'Leave `Params` out to get all users.',
        test: `pm.test('Users contains {{User_Name}}', () => {
    const ids = (pm.response.json().result.Users || []).map(u => String(u.UserID).toLowerCase());
    pm.expect(ids).to.include(String(pm.variables.get('User_Name')).toLowerCase());
});`,
    }),
    rpc('GetUserGroups', 'GetUserGroups', {}, {
        description: 'Returns the user groups the current user is a member of.',
        test: `pm.test('UserGroups contains the test group', () => {
    const names = (pm.response.json().result.UserGroups || []).map(g => g.Name);
    pm.expect(names).to.include(pm.variables.replaceIn(${JSON.stringify(N.group)}));
});`,
    }),
    rpc('GetTerms', 'GetTerms', {}, {
        test: `pm.test('Terms is an array', () => pm.expect(pm.response.json().result.Terms).to.be.an('array'));`,
    }),
    rpc('SaveUserSettings', 'SaveUserSettings', {
        Settings: [{ Setting: SETTING, Value: '42', __classname__: 'Setting' }],
    }, { description: 'Stores per-user settings (name/value pairs) for the client application given at LogOn.' }),
    rpc('GetUserSettings', 'GetUserSettings', { Settings: [SETTING] }, {
        description: 'Leave `Settings` out to get all settings of the client application.',
        test: expectEquals(`(result.Settings || []).find(x => x.Setting === pm.variables.replaceIn(${JSON.stringify(SETTING)})).Value`, '42', 'saved setting'),
    }),
    rpc('DeleteUserSettings', 'DeleteUserSettings', { Settings: [SETTING] }),
    rpc('GetMessageQueueInfo', 'GetMessageQueueInfo', {}),
    rpc('GetMessageList', 'GetMessageList', {}),
]);

// ---- 03 Brand configuration -------------------------------------------------------------------------------------

const brandConfig = folder('03 Brand configuration', [
    rpc('GetPublications', 'GetPublications', {
        IDs: [s('Wfl_Pub_Id')],
        RequestInfo: ['PubChannels', 'Categories'],
    }, {
        description: 'Leave `IDs` out to get all brands the user has access to.',
        test: expectIdIn('Publications', 'Wfl_Pub_Id'),
    }),
    rpc('GetAuthorizations', 'GetAuthorizations', { PublicationIds: [s('Wfl_Pub_Id')] }, {
        test: `pm.test('AuthorizationsPerPublication is an array', () => pm.expect(pm.response.json().result.AuthorizationsPerPublication).to.be.an('array'));`,
    }),
    rpc('GetCustomProperties', 'GetCustomProperties', {}),
    rpc('GetNamedQueries', 'GetNamedQueries', {}, {
        description: 'The test script keeps the name of the first named query in `Wfl_NamedQuery` for the NamedQuery call.',
        test: `
const queries = pm.response.json().result.NamedQueries || [];
if (queries.length) pm.collectionVariables.set('Wfl_NamedQuery', queries[0].Name);
pm.test('NamedQueries is an array', () => pm.expect(queries).to.be.an('array'));`,
    }),
    rpc('GetStates', 'GetStates', { Publication: publication, Type: 'Article' }, {
        description: 'Returns the statuses for an object type in a brand (optionally narrowed by `Issue` and `Section`), with the users and groups they can be routed to. Pass `ID` instead to get the statuses for an existing object.',
        test: `${expectIncludes('result.States', statusVar(P, 'Article', 0))}\n${expectIncludes('result.States', statusVar(P, 'Article', 1))}`,
    }),
]);

// ---- 04 Objects ---------------------------------------------------------------------------------------------------

const objects = folder('04 Objects', [
    rpc('CreateObjects Dossier', 'CreateObjects', {
        Lock: false,
        Objects: [{
            MetaData: metaData(`PM Test Dossier ${TAG}`, 'Dossier'),
            Targets: [target()],
            __classname__: 'Object',
        }],
    }, {
        description: 'Creates a dossier in the test issue. Objects are `Object` (the server maps it to `WflObject`); every nested structure needs its `__classname__`.',
        test: captureExpr(objectId, 'Wfl_Dossier_Id', 'dossier ID'),
    }),
    upload('Upload file to Transfer Server', 'Hello from the Postman Workflow test run.'),
    rpc('CreateObjects Article', 'CreateObjects', {
        Lock: false,
        Objects: [{
            MetaData: metaData(`PM Test Article ${TAG}`, 'Article', { format: 'text/plain' }),
            Files: textFile(),
            Relations: [relation('Wfl_Dossier_Id', null, 'Contained')],
            __classname__: 'Object',
        }],
    }, {
        description: 'Creates a plain text article inside the test dossier (`Relations` with `Type: "Contained"` and the dossier as `Parent`). The file was uploaded to the Transfer Server by the previous request; `FileUrl` points to it by its `fileguid`.',
        test: `${captureExpr(objectId, 'Wfl_Article_Id', 'article ID')}\n${captureExpr('result.Objects[0].MetaData.WorkflowMetaData.Version', 'Wfl_Article_Version', 'article version')}`,
    }),
    rpc('CreateObjects Task with Targets', 'CreateObjects', {
        Lock: false,
        Objects: [{
            MetaData: metaData(`PM Test Task ${TAG}`, 'Task'),
            Targets: [target()],
            __classname__: 'Object',
        }],
    }, { test: captureExpr(objectId, 'Wfl_Task_Id', 'task ID') }),
    rpc('GetObjects', 'GetObjects', {
        IDs: [s('Wfl_Article_Id')],
        Lock: false,
        Rendition: 'none',
        RequestInfo: ['MetaData', 'Targets', 'Relations'],
    }, {
        description: '`Rendition` is one of `none`, `thumb`, `preview`, `placement`, `native`, `output`, `trailer`. `RequestInfo` selects the parts to return, e.g. `MetaData`, `Targets`, `Relations`, `Pages`, `PagesInfo`, `Messages`, `Elements`, `RenditionsInfo`, `ObjectLabels`, `InDesignArticles`, `Placements`.',
        test: expectEquals(objectId, '{{Wfl_Article_Id}}', 'Objects[0] ID'),
    }),
    rpc('QueryObjects', 'QueryObjects', {
        Params: [queryParam('PublicationId', '=', s('Wfl_Pub_Id'))],
        FirstEntry: 1,
        MaxEntries: 50,
        Hierarchical: false,
        MinimalProps: ['ID', 'Type', 'Name'],
        RequestProps: ['ID', 'Type', 'Name', 'State', 'Modified'],
    }, {
        description: 'Searches objects. `Params` are ANDed; `Operation` is one of `<`, `>`, `<=`, `>=`, `=`, `!=`, `contains`, `starts`, `ends`, `within`, `between`. Results come back as `Columns` plus `Rows` (arrays of strings in column order).',
        test: `${expectRowsInclude('Wfl_Article_Id')}\n${expectRowsInclude('Wfl_Dossier_Id')}`,
    }),
    rpc('NamedQuery', 'NamedQuery', { Query: s('Wfl_NamedQuery'), Params: [], FirstEntry: 1, MaxEntries: 10 }, {
        description: 'Runs a named (saved) query. The query name comes from GetNamedQueries.',
    }),
    rpc('LockObjects', 'LockObjects', {
        HaveVersions: [{ ID: s('Wfl_Article_Id'), Version: s('Wfl_Article_Version'), __classname__: 'ObjectVersion' }],
    }, { test: expectIncludes('result.IDs', 'Wfl_Article_Id', 'x => x', 'result.IDs') }),
    rpc('UnlockObjects', 'UnlockObjects', { IDs: [s('Wfl_Article_Id')] }),
    rpc('GetObjects (lock for editing)', 'GetObjects', {
        IDs: [s('Wfl_Article_Id')],
        Lock: true,
        Rendition: 'native',
        RequestInfo: ['MetaData'],
    }, { description: 'Checks the article out (`Lock: true`) so SaveObjects can check a new version in.' }),
    upload('Upload file to Transfer Server (new version)', 'Hello again from the Postman Workflow test run. This is version 2.'),
    rpc('SaveObjects', 'SaveObjects', {
        CreateVersion: true,
        ForceCheckIn: false,
        Unlock: true,
        Objects: [{
            MetaData: metaData(`PM Test Article ${TAG}`, 'Article', { id: s('Wfl_Article_Id'), format: 'text/plain', comment: 'Saved by the Postman Workflow test run' }),
            Files: textFile(),
            __classname__: 'Object',
        }],
    }, {
        description: 'Checks in a new version of a locked object and unlocks it.',
        test: expectEquals(objectId, '{{Wfl_Article_Id}}', 'Objects[0] ID'),
    }),
    rpc('ListVersions', 'ListVersions', { ID: s('Wfl_Article_Id'), Rendition: 'none' }, {
        description: 'The test script keeps the oldest version in `Wfl_Old_Version` for GetVersion and RestoreVersion.',
        test: `${captureExpr('result.Versions[0].Version', 'Wfl_Old_Version', 'oldest version')}
pm.test('at least two versions', () => pm.expect((pm.response.json().result.Versions || []).length).to.be.at.least(2));`,
    }),
    rpc('GetVersion', 'GetVersion', { ID: s('Wfl_Article_Id'), Version: s('Wfl_Old_Version'), Rendition: 'native' }, {
        test: expectEquals('result.VersionInfo.Version', '{{Wfl_Old_Version}}', 'VersionInfo.Version'),
    }),
    rpc('RestoreVersion', 'RestoreVersion', { ID: s('Wfl_Article_Id'), Version: s('Wfl_Old_Version') }, {
        description: 'Makes an old version the current version again (as a new version).',
    }),
    rpc('SetObjectProperties', 'SetObjectProperties', {
        ID: s('Wfl_Article_Id'),
        MetaData: {
            WorkflowMetaData: { Comment: `Set by SetObjectProperties ${TAG}`, __classname__: 'WorkflowMetaData' },
            __classname__: 'MetaData',
        },
    }, {
        description: 'Changes properties of one object. Only the `MetaData` parts you pass are changed. Pass `Targets` to replace the object targets too.',
        test: expectEquals('result.MetaData.WorkflowMetaData.Comment', `Set by SetObjectProperties ${TAG}`, 'Comment'),
    }),
    rpc('GetDialog2', 'GetDialog2', {
        Action: 'SetProperties',
        MetaData: [{ Property: 'ID', PropertyValues: [{ Value: s('Wfl_Article_Id'), __classname__: 'PropertyValue' }], __classname__: 'MetaDataValue' }],
    }, {
        description: 'Returns the dialog definition (fields, lists, defaults) a client shows for an action. `Action` is one of `Create`, `CheckIn`, `SendTo`, `CopyTo`, `SetProperties`, `Query`, `Preview`. For `Create` and `Query` pass no object ID (give `Publication` and `Type` instead); for the other actions the object ID is required and must be given as `PropertyValues` (`[{ "Value": "<id>" }]`), not as `Values`, or the server answers that the object ID is not valid.',
        test: `pm.test('Dialog returned', () => pm.expect(pm.response.json().result.Dialog).to.be.an('object'));`,
    }),
    rpc('SendToNext', 'SendToNext', { IDs: [s('Wfl_Article_Id')] }, {
        description: 'Moves objects to the `NextStatus` of their current status (set up in the Setup folder: Draft → Ready).',
        test: expectEquals('result.RoutingMetaDatas[0].State.Id', `{{${statusVar(P, 'Article', 1)}}}`, 'new status'),
    }),
    rpc('SendTo', 'SendTo', {
        IDs: [s('Wfl_Article_Id')],
        WorkflowMetaData: { State: state('Article', 0), RouteTo: s('User_Name'), __classname__: 'WorkflowMetaData' },
    }, {
        description: 'Sends objects to a given status and/or routes them to a user or group.',
        test: expectEquals('result.SendTo.State.Id', `{{${statusVar(P, 'Article', 0)}}}`, 'new status'),
    }),
    rpc('CopyObject', 'CopyObject', {
        SourceID: s('Wfl_Article_Id'),
        MetaData: metaData(`PM Test Article Copy ${TAG}`, 'Article'),
        Relations: [relation('Wfl_Dossier_Id', null, 'Contained')],
    }, {
        description: 'Copies an object. `MetaData` holds the properties of the copy (at least Name, Publication, Category and State). This sample places the copy in the same dossier.',
        test: captureExpr('result.MetaData.BasicMetaData.ID', 'Wfl_ArticleCopy_Id', 'copy ID'),
    }),
    rpc('MultiSetObjectProperties', 'MultiSetObjectProperties', {
        IDs: [s('Wfl_Article_Id'), s('Wfl_ArticleCopy_Id')],
        MetaData: [metaValue('Comment', [`Set by MultiSetObjectProperties ${TAG}`])],
    }, { description: 'Sets the same property values on several objects. Properties are given by name as `MetaDataValue`. All objects must be of the same type and in the same brand (the server rejects a mix).' }),
    rpc('GetObjects (lock for offline editing)', 'GetObjects', {
        IDs: [s('Wfl_Article_Id')],
        Lock: true,
        Rendition: 'none',
    }, { description: 'ChangeOnlineStatus only works on objects the user has checked out, so lock the article first.' }),
    rpc('ChangeOnlineStatus (TakeOffline)', 'ChangeOnlineStatus', { IDs: [s('Wfl_Article_Id')], OnlineStatus: 'TakeOffline' }, {
        description: 'Marks objects the user has checked out as taken offline (for offline editing), or back online with `TakeOnline`. On objects that are not locked by the user the server fails with "Database error (S1004)".',
    }),
    rpc('ChangeOnlineStatus (TakeOnline)', 'ChangeOnlineStatus', { IDs: [s('Wfl_Article_Id')], OnlineStatus: 'TakeOnline' }),
    rpc('UnlockObjects (after offline editing)', 'UnlockObjects', { IDs: [s('Wfl_Article_Id')] }),
]);

// ---- 05 Relations -------------------------------------------------------------------------------------------------

const relations = folder('05 Relations', [
    rpc('GetObjectRelations', 'GetObjectRelations', { ID: s('Wfl_Dossier_Id') }, {
        test: expectIncludes('result.Relations', 'Wfl_Article_Id', 'r => r.Child', 'Relations[].Child'),
    }),
    rpc('CreateObjectRelations', 'CreateObjectRelations', {
        Relations: [relation('Wfl_Dossier_Id', 'Wfl_Task_Id', 'Contained')],
    }, {
        description: 'Puts the task in the dossier. `Type` is one of `Placed`, `Planned`, `Candidate`, `Contained`, `Related`, `InstanceOf`. `Placed` relations also carry `Placements`. The server only accepts combinations that make sense for the object types: `Related` between an article and a task, or a dossier and a task, is rejected with "Invalid operation (S1019)".',
        test: expectIncludes('result.Relations', 'Wfl_Task_Id', 'r => r.Child', 'Relations[].Child'),
    }),
    rpc('UpdateObjectRelations', 'UpdateObjectRelations', {
        Relations: [relation('Wfl_Dossier_Id', 'Wfl_Task_Id', 'Contained', { Rating: 3 })],
    }, { test: expectEquals('result.Relations[0].Rating', '3', 'Relations[0].Rating') }),
    rpc('DeleteObjectRelations', 'DeleteObjectRelations', {
        Relations: [relation('Wfl_Dossier_Id', 'Wfl_Task_Id', 'Contained')],
    }),
    rpc('CreateObjectRelationsAsync', 'CreateObjectRelationsAsync', {
        Relations: [relation('Wfl_Dossier_Id', 'Wfl_Task_Id', 'Contained')],
    }, {
        description: 'Same as CreateObjectRelations, but runs in the background. Poll GetCreateObjectRelationsAsyncProgress with the returned `OperationId`.',
        test: captureExpr('result.OperationId', 'Wfl_Async_Operation_Id', 'OperationId'),
    }),
    rpc('GetCreateObjectRelationsAsyncProgress', 'GetCreateObjectRelationsAsyncProgress', { OperationId: s('Wfl_Async_Operation_Id') }, {
        description: '`Progress` runs up to 100; `Relations` is returned when the operation is done.',
        test: `pm.test('Progress is a number', () => pm.expect(pm.response.json().result.Progress).to.be.a('number'));`,
    }),
]);

// ---- 06 Targets ---------------------------------------------------------------------------------------------------

const targets = folder('06 Targets', [
    rpc('CreateObjectTargets', 'CreateObjectTargets', {
        IDs: [s('Wfl_Dossier_Id')],
        Targets: [target('Wfl_Issue2_Id', N.issue2)],
    }, {
        description: 'Adds targets (channel / issue / editions) to objects.',
        test: expectIncludes('result.Targets', 'Wfl_Issue2_Id', 't => t.Issue.Id', 'Targets[].Issue.Id'),
    }),
    rpc('UpdateObjectTargets', 'UpdateObjectTargets', {
        IDs: [s('Wfl_Dossier_Id')],
        Targets: [target('Wfl_Issue2_Id', N.issue2, {
            Editions: [{ Id: s('Wfl_Edition_Id'), Name: N.edition, __classname__: 'Edition' }],
        })],
    }, {
        description: 'Changes existing targets, here limiting the second issue to one edition.',
        test: expectIncludes('(result.Targets || []).flatMap(t => t.Editions || [])', 'Wfl_Edition_Id', 'e => e.Id', 'Targets[].Editions[].Id'),
    }),
    rpc('DeleteObjectTargets', 'DeleteObjectTargets', {
        IDs: [s('Wfl_Dossier_Id')],
        Targets: [target('Wfl_Issue2_Id', N.issue2)],
    }),
]);

// ---- 07 Object labels ---------------------------------------------------------------------------------------------

const labels = folder('07 Object labels', [
    rpc('CreateObjectLabels', 'CreateObjectLabels', {
        ObjectId: s('Wfl_Dossier_Id'),
        ObjectLabels: [{ Name: `PM Label ${TAG}`, __classname__: 'ObjectLabel' }],
    }, {
        description: 'Object labels are defined on a dossier (`ObjectId`) and can then be given to objects in that dossier. Label IDs are numbers.',
        test: capture('ObjectLabels', 'Wfl_Label_Id'),
    }),
    rpc('UpdateObjectLabels', 'UpdateObjectLabels', {
        ObjectLabels: [{ Id: n('Wfl_Label_Id'), Name: `PM Label ${TAG} (renamed)`, __classname__: 'ObjectLabel' }],
    }, {
        description: 'Not implemented on Studio Server 10.70 (the server answers "The WflUpdateObjectLabels Service isn\'t implemented yet"), so the test run skips it. Set `Wfl_Run_UpdateObjectLabels` to any value to try it.',
        prerequest: `if (!pm.variables.get('Wfl_Run_UpdateObjectLabels')) pm.execution.skipRequest();`,
        test: expectProp('ObjectLabels', 'Name', `PM Label ${TAG} (renamed)`),
    }),
    rpc('AddObjectLabels', 'AddObjectLabels', {
        ParentId: s('Wfl_Dossier_Id'),
        ChildIds: [s('Wfl_Article_Id')],
        ObjectLabels: [label('Wfl_Label_Id')],
    }, { description: 'Gives the label to objects (`ChildIds`) in the dossier (`ParentId`).' }),
    rpc('RemoveObjectLabels', 'RemoveObjectLabels', {
        ParentId: s('Wfl_Dossier_Id'),
        ChildIds: [s('Wfl_Article_Id')],
        ObjectLabels: [label('Wfl_Label_Id')],
    }),
    rpc('DeleteObjectLabels', 'DeleteObjectLabels', { ObjectLabels: [label('Wfl_Label_Id')] }),
]);

// ---- 08 Messages --------------------------------------------------------------------------------------------------

const messages = folder('08 Messages', [
    rpc('SendMessages', 'SendMessages', {
        Messages: [{
            ObjectID: s('Wfl_Article_Id'),
            MessageType: 'user',
            MessageTypeDetail: 'Postman',
            Message: `Hello from the Postman Workflow test run ${TAG}`,
            MessageLevel: 'Info',
            __classname__: 'Message',
        }],
    }, {
        description: 'Sends messages to objects (`ObjectID`) or users (`UserID`). `MessageType` is one of `system`, `client`, `user`, `sticky`, `reply`.',
        test: captureExpr('result.MessageList.Messages[0].MessageID', 'Wfl_Message_Id', 'MessageID'),
    }),
    rpc('SendMessages (delete message)', 'SendMessages', {
        MessageList: { DeleteMessageIDs: [s('Wfl_Message_Id')], __classname__: 'MessageList' },
    }, { description: 'Deletes messages by ID with `MessageList.DeleteMessageIDs` (mark them read with `ReadMessageIDs`).' }),
]);

// ---- 09 Samples that need server configuration or your own objects ----------------------------------------------

const samplesConfig = folder('09 Samples: server configuration', [
    rpc('GetWebAppAuthenticationInfo', 'GetWebAppAuthenticationInfo', {
        ApplicationUrl: s('Wfl_WebApp_Url'),
        ClientName: 'postman',
        ClientAppName: 'postman_sample_requests',
    }, { description: 'For single sign-on: returns the identity provider URL a web app redirects to. Set `Wfl_WebApp_Url` to run it.' }),
    rpc('GetNativeAppAuthenticationInfo', 'GetNativeAppAuthenticationInfo', {
        ApplicationProtocol: s('Wfl_Native_App_Protocol'),
        CodeChallenge: s('Wfl_Code_Challenge'),
    }, { description: 'For single sign-on from a native app (PKCE). Set `Wfl_Native_App_Protocol` and `Wfl_Code_Challenge` to run it.' }),
    rpc('GetTenantId', 'GetTenantId', { TenantAuthToken: s('Wfl_Tenant_Auth_Token') }, {
        description: 'Studio cloud only. Set `Wfl_Tenant_Auth_Token` to run it.',
    }),
    rpc('SaveAIPrompt', 'SaveAIPrompt', {
        AIPrompt: { PromptType: s('Wfl_AI_Prompt_Type'), PromptText: `Postman test prompt ${TAG}`, BrandId: s('Wfl_Pub_Id'), __classname__: 'AIPrompt' },
    }, { description: 'Stores an AI prompt for a brand. Set `Wfl_AI_Prompt_Type` to run it.' }),
    rpc('GetAIPrompt', 'GetAIPrompt', { PromptType: s('Wfl_AI_Prompt_Type'), BrandId: s('Wfl_Pub_Id') }, {
        test: expectEquals('result.AIPrompt.PromptText', `Postman test prompt ${TAG}`, 'AIPrompt.PromptText'),
    }),
    rpc('CheckSpelling', 'CheckSpelling', {
        Language: s('Wfl_Spelling_Language'),
        PublicationId: s('Wfl_Pub_Id'),
        WordsToCheck: ['hello', 'wrold'],
    }, { description: 'Needs a spelling engine configured for the language (e.g. `enUS`). Set `Wfl_Spelling_Language` to run the spelling samples.' }),
    rpc('GetSuggestions', 'GetSuggestions', {
        Language: s('Wfl_Spelling_Language'),
        PublicationId: s('Wfl_Pub_Id'),
        WordsToCheck: ['wrold'],
    }),
    rpc('CheckSpellingAndSuggest', 'CheckSpellingAndSuggest', {
        Language: s('Wfl_Spelling_Language'),
        PublicationId: s('Wfl_Pub_Id'),
        WordsToCheck: ['hello', 'wrold'],
    }),
    rpc('Autocomplete', 'Autocomplete', {
        AutocompleteProvider: s('Wfl_Autocomplete_Provider'),
        ObjectId: s('Wfl_Article_Id'),
        Property: { Name: s('Wfl_Autocomplete_Property'), Entity: s('Wfl_Autocomplete_Entity'), __classname__: 'AutoSuggestProperty' },
        TypedValue: 'a',
    }, { description: 'Needs an autocomplete provider plugin. Set `Wfl_Autocomplete_Provider`, `Wfl_Autocomplete_Property` and `Wfl_Autocomplete_Entity` to run it.' }),
    rpc('Suggestions', 'Suggestions', {
        SuggestionProvider: s('Wfl_Suggestion_Provider'),
        ObjectId: s('Wfl_Article_Id'),
        MetaData: [metaValue('PlainContent', ['WoodWing Studio is a content orchestration platform.'])],
        SuggestForProperties: [{ Name: s('Wfl_Autocomplete_Property'), Entity: s('Wfl_Autocomplete_Entity'), __classname__: 'AutoSuggestProperty' }],
    }, { description: 'Needs a suggestion provider plugin (the channel\'s `SuggestionProvider`). Set `Wfl_Suggestion_Provider` to run it.' }),
    rpc('SetObjectExternalProperties', 'SetObjectExternalProperties', {
        ID: s('Wfl_Article_Id'),
        MetaData: [metaValue(s('Wfl_External_Property'), ['Postman'])],
    }, { description: 'Sets properties that are owned by an external system (a content source plugin). Set `Wfl_External_Property` to run it.' }),
    rpc('SetObjectProperties Custom Field', 'SetObjectProperties', {
        ID: s('Wfl_Article_Id'),
        MetaData: {
            ExtraMetaData: [{ Property: s('Wfl_Custom_Property'), Values: [`Postman ${TAG}`], __classname__: 'ExtraMetaData' }],
            __classname__: 'MetaData',
        },
    }, { description: 'Sets a custom property (`C_...`) through `ExtraMetaData`. Set `Wfl_Custom_Property` to the name of a custom text property to run it.' }),
    rpc('ChangePassword', 'ChangePassword', { Old: s('Password'), New: s('Wfl_New_Password') }, {
        description: 'Changes the password of {{User_Name}}. Only runs when `Wfl_New_Password` is set; the next request changes it back.',
    }),
    rpc('ChangePassword (change back)', 'ChangePassword', { Old: s('Wfl_New_Password'), New: s('Password') }),
], {
    description: 'Calls that depend on server set-up (single sign-on, cloud tenant, AI, spelling, autocomplete and suggestion plugins, custom properties). Each one is skipped until you set the `Wfl_*` variable(s) it uses.',
});

const operation = (name, type, params) => ({
    Id: '{{$guid}}',
    Name: name,
    Type: type,
    Params: Object.entries(params).map(([k, v]) => ({ Name: k, Value: v, __classname__: 'Param' })),
    __classname__: 'ObjectOperation',
});
const haveLayout = { ID: s('Wfl_Layout_Id'), Version: s('Wfl_Layout_Version'), __classname__: 'ObjectVersion' };

const samplesObjects = folder('10 Samples: your own layouts, templates and InCopy articles', [
    rpc('InstantiateTemplate', 'InstantiateTemplate', {
        Lock: false,
        Rendition: 'none',
        TemplateId: s('Wfl_Template_Id'),
        Objects: [{ MetaData: metaData(`PM From Template ${TAG}`, 'Article'), __classname__: 'Object' }],
    }, {
        description: 'Creates an object from a template (`TemplateId`) in the test brand. Set `Wfl_Template_Id` to run it; the next request deletes the new object.',
        test: captureExpr(objectId, 'Wfl_FromTemplate_Id', 'new object ID'),
    }),
    rpc('DeleteObjects (instantiated object)', 'DeleteObjects', { IDs: [s('Wfl_FromTemplate_Id')], Permanent: true }),
    rpc('GetPages', 'GetPages', { IDs: [s('Wfl_Layout_Id')], Renditions: ['thumb'] }, {
        description: 'Page renditions of layouts. Set `Wfl_Layout_Id` to run the page samples.',
    }),
    rpc('GetPagesInfo', 'GetPagesInfo', { IDs: [s('Wfl_Layout_Id')] }),
    rpc('GetRelatedPages', 'GetRelatedPages', { LayoutId: s('Wfl_Layout_Id'), PageSequences: [1], Rendition: 'thumb' }),
    rpc('GetRelatedPagesInfo', 'GetRelatedPagesInfo', { LayoutId: s('Wfl_Layout_Id'), PageSequences: [1] }),
    rpc('CreateObjectOperations PlaceDossier', 'CreateObjectOperations', {
        HaveVersion: haveLayout,
        Operations: [operation('PlaceDossier', 'AutomatedPrintWorkflow', {
            EditionId: '0', DossierId: s('Wfl_Place_Dossier_Id'), InDesignArticleId: s('Wfl_InDesignArticle_Id'),
        })],
    }, {
        description: 'Queues an operation on a layout that InDesign Server carries out the next time the layout is opened. `HaveVersion` must be the current layout version. `Type` is `AutomatedPrintWorkflow` (Name: `PlaceDossier`, `PlaceArticleElement`, `PlaceImage`, `ClearFrameContent`) or `ContentStationDigitalEditor` (Name: `PlaceDigitalArticle`). Param values are strings. Set `Wfl_Layout_Id`, `Wfl_Layout_Version` and the IDs each sample uses to run them.',
    }),
    rpc('CreateObjectOperations PlaceDigitalArticle', 'CreateObjectOperations', {
        HaveVersion: haveLayout,
        Operations: [operation('PlaceDigitalArticle', 'ContentStationDigitalEditor', {
            EditionId: '0', ArticleId: s('Wfl_Place_Digital_Article_Id'), InDesignArticleId: s('Wfl_InDesignArticle_Id'), ConversionRuleSetId: s('Wfl_ConversionRuleSet_Id'),
        })],
    }, { description: 'There is currently no public call to look up `ConversionRuleSetId`; find it in the server log of a placement made from Studio.' }),
    rpc('CreateObjectOperations PlaceArticleElement', 'CreateObjectOperations', {
        HaveVersion: haveLayout,
        Operations: [operation('PlaceArticleElement', 'AutomatedPrintWorkflow', {
            EditionId: '0', ArticleId: s('Wfl_Place_Article_Id'), ElementId: s('Wfl_Element_Id'), SplineId: s('Wfl_Spline_Id'),
        })],
    }),
    rpc('CreateObjectOperations PlaceImage', 'CreateObjectOperations', {
        HaveVersion: haveLayout,
        Operations: [operation('PlaceImage', 'AutomatedPrintWorkflow', {
            EditionId: '0', ImageId: s('Wfl_Place_Image_Id'), SplineId: s('Wfl_Spline_Id'), ContentDx: '0', ContentDy: '0', ScaleX: '1', ScaleY: '1',
        })],
    }),
    rpc('CreateObjectOperations ClearFrameContent', 'CreateObjectOperations', {
        HaveVersion: haveLayout,
        Operations: [operation('ClearFrameContent', 'AutomatedPrintWorkflow', { EditionId: '0', SplineId: s('Wfl_Spline_Id') })],
    }),
    rpc('CreateArticleWorkspace', 'CreateArticleWorkspace', { ID: s('Wfl_Wcml_Article_Id'), Format: 'application/incopyicml' }, {
        description: 'Opens an InCopy (WCML) article in a server-side workspace, for editing and previewing through InDesign Server. Only `application/incopyicml` and `application/incopy` are supported. Set `Wfl_Wcml_Article_Id` to run the workspace samples.',
        test: captureExpr('result.WorkspaceId', 'Wfl_Workspace_Id', 'WorkspaceId'),
    }),
    rpc('ListArticleWorkspaces', 'ListArticleWorkspaces', {}, {
        description: 'Lists the workspace IDs of the current user. Has no parameters, so it also runs when the other workspace samples are skipped.',
        test: `
const workspaces = pm.response.json().result.Workspaces || [];
pm.test('Workspaces is an array', () => pm.expect(workspaces).to.be.an('array'));
if (pm.collectionVariables.get('Wfl_Workspace_Id')) {
    pm.test('Workspaces contains {{Wfl_Workspace_Id}}', () => pm.expect(workspaces).to.include(pm.collectionVariables.get('Wfl_Workspace_Id')));
}`,
    }),
    rpc('GetArticleFromWorkspace', 'GetArticleFromWorkspace', { WorkspaceId: s('Wfl_Workspace_Id') }),
    rpc('SaveArticleInWorkspace', 'SaveArticleInWorkspace', { WorkspaceId: s('Wfl_Workspace_Id'), ID: s('Wfl_Wcml_Article_Id'), Format: 'application/incopyicml' }, {
        description: 'Saves changed `Content` or `Elements` in the workspace (not in the database). This sample saves without changes.',
    }),
    rpc('PreviewArticleAtWorkspace', 'PreviewArticleAtWorkspace', {
        WorkspaceId: s('Wfl_Workspace_Id'),
        ID: s('Wfl_Wcml_Article_Id'),
        Format: 'application/incopyicml',
        Action: 'Compose',
    }, { description: '`Action` is `Compose` (copyfit info only), `Preview` (page previews) or `PDF`.' }),
    rpc('PreviewArticlesAtWorkspace', 'PreviewArticlesAtWorkspace', {
        WorkspaceId: s('Wfl_Workspace_Id'),
        Articles: [{ ID: s('Wfl_Wcml_Article_Id'), Format: 'application/incopyicml', __classname__: 'ArticleAtWorkspace' }],
        Action: 'Compose',
    }),
    rpc('DeleteArticleWorkspace', 'DeleteArticleWorkspace', { WorkspaceId: s('Wfl_Workspace_Id') }),
], {
    description: 'Calls that need objects the test brand cannot provide (a layout with pages, a template, an InCopy article). Each one is skipped until you set the `Wfl_*` variable(s) it uses.',
});

// ---- 11 Clean up objects ------------------------------------------------------------------------------------------

const allObjects = ['Wfl_ArticleCopy_Id', 'Wfl_Article_Id', 'Wfl_Task_Id', 'Wfl_Dossier_Id'];
const cleanup = folder('11 Delete and restore objects', [
    rpc('DeleteObjects (to Trash)', 'DeleteObjects', { IDs: [s('Wfl_ArticleCopy_Id')], Permanent: false, Areas: ['Workflow'] }, {
        description: '`Permanent: false` moves objects to the Trash Can; `true` deletes them for good. `Areas` is `Workflow` or `Trash` (to purge objects from the Trash Can).',
        test: expectIncludes('result.IDs', 'Wfl_ArticleCopy_Id', 'x => x', 'result.IDs'),
    }),
    rpc('RestoreObjects', 'RestoreObjects', { IDs: [s('Wfl_ArticleCopy_Id')] }, {
        description: 'Restores objects from the Trash Can.',
        test: expectIncludes('result.IDs', 'Wfl_ArticleCopy_Id', 'x => x', 'result.IDs'),
    }),
    rpc('DeleteObjects (permanent)', 'DeleteObjects', { IDs: allObjects.map(s), Permanent: true, Areas: ['Workflow'] }, {
        test: allObjects.map(v => expectIncludes('result.IDs', v, 'x => x', 'result.IDs')).join('\n'),
    }),
    rpc('QueryObjects (verify cleanup)', 'QueryObjects', {
        Params: [queryParam('PublicationId', '=', s('Wfl_Pub_Id'))],
        MinimalProps: ['ID'],
        RequestProps: ['ID'],
    }, {
        test: `pm.test('no objects left in the test brand', () => pm.expect((pm.response.json().result.Rows || []).length).to.eql(0));`,
    }),
    rpc('LogOff', 'LogOff', {}, {
        description: 'Logs off. `SaveSettings` with `Settings` stores user settings at the same time.',
        test: `pm.environment.unset('Current_Ticket');`,
    }),
]);

export const workflow = folder('Workflow', [
    fixtureSetup(P, 'Workflow', [{ type: 'Article', count: 2 }, { type: 'Dossier', count: 1 }, { type: 'Task', count: 1 }]),
    session,
    userAndSettings,
    brandConfig,
    objects,
    relations,
    targets,
    labels,
    messages,
    samplesConfig,
    samplesObjects,
    cleanup,
    fixtureTeardown(P),
], {
    description: [
        'Workflow interface (`index.php`) calls, one or more per SDK service.',
        '',
        '**Running it as a test.** The folder runs top to bottom on a throw-away brand: the Setup folder creates it through the Administration interface (brand, channel, two issues, edition, section, statuses, an access profile with every feature, and a group that holds `{{User_Name}}`), the numbered folders exercise the Workflow calls on a dossier, a plain-text article, a copy and a task, and the Teardown folder removes everything again. IDs of the test objects are kept in `Wfl_*` collection variables.',
        '',
        '**Environment variables used:** `Studio_Server_URL`, `Studio_Server_Directory`, `User_Name`, `Password`, `Current_Ticket` (set by LogOn), `Admin_User_Name`, `Admin_User_Password`, `Admin_Current_Ticket` (for Setup/Teardown).',
        '',
        '**Samples.** Folders 09 and 10 hold calls that need server configuration or objects of your own. They are skipped until you set the `Wfl_*` collection variables they use (see each request description).',
        '',
        '**Body conventions** (checked against `sdk/typescript/wfl/index.d.ts`):',
        '- Workflow IDs are **strings** (`"ID": "{{Object_Id}}"`), unlike Administration IDs, which are integers. Numeric fields such as `Rating`, `Order`, `FirstEntry`, `ObjectLabel.Id` and placement coordinates are numbers.',
        '- Every nested object needs its `__classname__` (`Object`, `MetaData`, `BasicMetaData`, `Publication`, `Category`, `State`, `Target`, `Relation`, ...).',
        '- Files are uploaded to the Transfer Server first (`PUT transferindex.php?ticket=...&fileguid=...`) and referred to by `FileUrl` in `Files`.',
    ].join('\n'),
    prerequest: GUARD_PREREQUEST,
    test: RPC_TEST,
});

