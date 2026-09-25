// Planning (editorialplan.php) folder: the interface planning systems use to create layouts and adverts.
// Planning refers to brands, issues, sections and statuses by NAME, not by ID.
//
// Adverts can only be created on a layout, and Planning creates layouts from a layout template. The test brand has
// no template, so the run copies an existing one into it first (Pln_Template_Source_Id, through the Workflow
// interface). Without that variable the layout and advert calls are skipped.
import {
    capture, captureExpr, expectEquals, folder, GUARD_PREREQUEST, RPC_TEST, rpcBuilder, s, storeTicket,
} from '../lib/postman.mjs';
import { fixtureNames, fixtureSetup, fixtureTeardown, statusVar } from './fixtures.mjs';

const P = 'Pln';
const rpc = rpcBuilder('pln', 'Planning_Ticket');
const wfl = rpcBuilder('wfl', 'Current_Ticket');
const N = fixtureNames(P, 'Planning');
const TAG = s('Pln_Run_Tag');
const TEMPLATE_NAME = `PM Planning Template ${TAG}`;

export const variables = {
    Pln_Run_Tag: '',
    Pln_Template_Source_Id: '',
};

const logOnFields = {
    User: s('User_Name'),
    Password: s('Password'),
    ClientName: 'postman',
    ClientAppName: 'postman_sample_requests',
    ClientAppVersion: '1.0',
};

// ---- 01 Copy a layout template into the test brand (Workflow interface) -----------------------------------------

const template = folder('01 Layout template (Workflow interface)', [
    wfl('LogOn (Workflow)', 'LogOn', { ...logOnFields, RequestInfo: [] }, {
        ticket: false,
        test: storeTicket('Current_Ticket'),
    }),
    wfl('CopyObject (layout template into the test brand)', 'CopyObject', {
        SourceID: s('Pln_Template_Source_Id'),
        MetaData: {
            BasicMetaData: {
                Name: TEMPLATE_NAME,
                Type: 'LayoutTemplate',
                Publication: { Id: s('Pln_Pub_Id'), Name: N.brand, __classname__: 'Publication' },
                Category: { Id: s('Pln_Section_Id'), Name: N.section, __classname__: 'Category' },
                __classname__: 'BasicMetaData',
            },
            WorkflowMetaData: {
                State: { Id: s(statusVar(P, 'LayoutTemplate', 0)), Name: N.status('LayoutTemplate', 0), Type: 'LayoutTemplate', __classname__: 'State' },
                __classname__: 'WorkflowMetaData',
            },
            __classname__: 'MetaData',
        },
    }, {
        description: 'Copies an existing layout template (`Pln_Template_Source_Id`, the object ID of any layout template on the server) into the test brand, so CreateLayouts has a template to work from. Set `Pln_Template_Source_Id` to run the layout and advert calls.',
        test: captureExpr('result.MetaData.BasicMetaData.ID', 'Pln_TemplateCopy_Id', 'template copy ID'),
    }),
]);

// ---- 02 Layouts and adverts (Planning interface) ----------------------------------------------------------------

const planned = extra => ({
    Publication: N.brand,
    PubChannel: N.channel,
    Issue: N.issue,
    Section: N.section,
    ...extra,
});

// On a layout an advert needs a Page and a Placement: without them Studio Server 10.70 fails with
// "Uncaught throwable "Error"" (and still creates the advert object).
const position = {
    Page: { PageOrder: 1, __classname__: 'PlnPage' },
    Placement: { Left: 36, Top: 36, Width: 200, Height: 100, __classname__: 'PlnPlacement' },
};
const advert = extra => ({ ...planned({ Status: N.status('Advert', 0) }), ...position, ...extra, __classname__: 'PlnAdvert' });

const layoutsAndAdverts = folder('02 Layouts and adverts', [
    rpc('LogOn - Planning', 'LogOn', { ...logOnFields, ClientAppName: 'postman_planning_requests' }, {
        ticket: false,
        description: 'Logs on to the Planning interface. The ticket is stored in `Planning_Ticket`, separate from the Workflow `Current_Ticket`.\n\nThe `ClientAppName` differs from the Workflow LogOn on purpose: a new LogOn by the same user with the same client application replaces that user\'s earlier ticket, which would break the Workflow session opened in folder 01.',
        test: storeTicket('Planning_Ticket'),
    }),
    rpc('CreateLayouts', 'CreateLayouts', {
        Layouts: [{
            NewLayout: {
                ...planned({ Status: N.status('Layout', 0) }),
                Name: `PM Planned Layout ${TAG}`,
                Pages: [
                    { PageOrder: 1, PageNumber: '1', __classname__: 'PlnPage' },
                    { PageOrder: 2, PageNumber: '2', __classname__: 'PlnPage' },
                ],
                __classname__: 'PlnLayout',
            },
            Template: TEMPLATE_NAME,
            __classname__: 'PlnLayoutFromTemplate',
        }],
    }, {
        description: 'Creates layouts from a layout template; `Template` is the template **name** and must exist in the same brand (the test run copies one in, see folder 01; the request is skipped when that copy was not made).',
        prerequest: `if (!pm.collectionVariables.get('Pln_TemplateCopy_Id')) pm.execution.skipRequest();`,
        test: capture('Layouts', 'Pln_Layout_Id'),
    }),
    rpc('CreateAdverts', 'CreateAdverts', {
        LayoutId: s('Pln_Layout_Id'),
        Adverts: [advert({
            Name: `PM Advert ${TAG}`,
            AlienId: `pm-advert-${TAG}`,
            AdType: 'Full page',
            Comment: 'Created by the Postman Planning test run',
            PlainContent: 'Postman test advert',
            Rate: 100,
        })],
    }, {
        description: 'Creates adverts on a layout (`LayoutId` or `LayoutName`), placed with `Page` (the page by `PageOrder`) and `Placement` (position and size in points). `AlienId` is the ID of the advert in the planning system.\n\nFound on Studio Server 10.70:\n- Without a layout the server refuses with "The advert could not be created because the layouttemplate, advert name, content, Publication or Issue was not specified".\n- On a layout without `Page` **and** `Placement` it fails with "Uncaught throwable \\"Error\\"".\n- In both of those cases, and with a `LayoutName` that does not exist, it returns an error **but still creates the advert object**.',
        test: capture('Adverts', 'Pln_Advert_Id'),
    }),
    rpc('ModifyAdverts', 'ModifyAdverts', {
        LayoutId: s('Pln_Layout_Id'),
        Adverts: [advert({
            Id: s('Pln_Advert_Id'),
            Name: `PM Advert ${TAG}`,
            Comment: 'Modified by the Postman Planning test run',
        })],
    }, {
        description: 'The Planning responses only echo the identity of the adverts (Id, names, Version); the other fields come back as null. The next request reads the advert through the Workflow interface to check the change.',
        test: expectEquals('result.Adverts[0].Id', '{{Pln_Advert_Id}}', 'Adverts[0].Id'),
    }),
    wfl('GetObjects (check the modified advert)', 'GetObjects', {
        IDs: [s('Pln_Advert_Id')],
        Lock: false,
        Rendition: 'none',
        RequestInfo: ['MetaData'],
    }, {
        description: 'Workflow GetObjects on the advert, to check that ModifyAdverts stored the new comment.',
        test: expectEquals('result.Objects[0].MetaData.WorkflowMetaData.Comment', 'Modified by the Postman Planning test run', 'advert Comment'),
    }),
    rpc('DeleteAdverts', 'DeleteAdverts', {
        LayoutId: s('Pln_Layout_Id'),
        Adverts: [{ Id: s('Pln_Advert_Id'), __classname__: 'PlnAdvert' }],
    }),
    rpc('ModifyLayouts', 'ModifyLayouts', {
        Layouts: [{
            ...planned({ Status: N.status('Layout', 0) }),
            Id: s('Pln_Layout_Id'),
            Name: `PM Planned Layout ${TAG}`,
            Pages: [
                { PageOrder: 1, PageNumber: 'A1', __classname__: 'PlnPage' },
                { PageOrder: 2, PageNumber: 'A2', __classname__: 'PlnPage' },
            ],
            __classname__: 'PlnLayout',
        }],
    }, { description: 'Changes planned layouts, here renumbering the pages.' }),
    rpc('DeleteLayouts', 'DeleteLayouts', {
        Layouts: [{ Id: s('Pln_Layout_Id'), __classname__: 'PlnLayout' }],
    }),
    rpc('LogOff - Planning', 'LogOff', {}, { test: `pm.environment.unset('Planning_Ticket');` }),
]);

export const planning = folder('Planning', [
    fixtureSetup(P, 'Planning', [{ type: 'Advert', count: 1 }, { type: 'Layout', count: 1 }, { type: 'LayoutTemplate', count: 1 }]),
    template,
    layoutsAndAdverts,
    fixtureTeardown(P),
], {
    description: [
        'Planning interface (`editorialplan.php`), used by editorial planning systems to create layouts and adverts.',
        '',
        '**Running it as a test.** The Setup folder creates a throw-away brand with Advert, Layout and LayoutTemplate statuses (Administration interface). Adverts can only be created on a layout, and Planning creates layouts from a layout template, so folder 01 copies an existing template (`Pln_Template_Source_Id`) into the test brand. Folder 02 then creates a layout from it, creates, modifies and deletes an advert on the layout, and modifies and deletes the layout. The Teardown folder purges anything left and removes the brand. Without `Pln_Template_Source_Id` only the Planning LogOn/LogOff run.',
        '',
        '**Body conventions:** Planning refers to `Publication`, `PubChannel`, `Issue`, `Section`, `Status` and `Template` by **name**. `Id` fields are strings. Nested objects need their `__classname__` (`PlnAdvert`, `PlnLayout`, `PlnLayoutFromTemplate`, `PlnPage`, ...).',
    ].join('\n'),
    prerequest: GUARD_PREREQUEST,
    test: RPC_TEST,
});
