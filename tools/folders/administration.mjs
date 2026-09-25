// Administration (adminindex.php) and System Administration (sysadminindex.php) folders.
import {
    capture, expectIdIn, expectProp, folder, GUARD_PREREQUEST, n, RPC_TEST, rpcBuilder, s, startRun, storeTicket,
} from '../lib/postman.mjs';

const rpc = rpcBuilder('adm', 'Admin_Current_Ticket');
const sysRpc = rpcBuilder('sys', 'Admin_Current_Ticket');

// Collection variables this folder uses (besides the Adm_*Id variables its Create calls set).
export const variables = { Adm_Run_Tag: '', Test_User_Password: '', Adm_Autocomplete_Provider: '' };

// ---- Requests -------------------------------------------------------------------------------------------------

const TAG = s('Adm_Run_Tag');

const logOn = rpc('LogOn - Administration', 'LogOn', {
    AdminUser: s('Admin_User_Name'),
    Password: s('Admin_User_Password'),
    ClientName: 'postman',
    ClientAppName: 'postman_sample_admin_request',
    ClientAppVersion: '1.0',
}, {
    ticket: false,
    description: 'Logs on to the Administration interface. The test script stores the ticket in the `Admin_Current_Ticket` environment variable, which every other Administration call uses.\n\nThe pre-request script also starts a new test run: it clears the `Adm_*` ID variables of a previous run and sets `Adm_Run_Tag`, a short unique suffix for the names of the test entities.',
    prerequest: startRun('Adm'),
    test: storeTicket('Admin_Current_Ticket'),
});

const logOff = rpc('LogOff - Administration', 'LogOff', {}, {
    description: 'Logs off the Administration session and invalidates `Admin_Current_Ticket`.',
    test: `pm.environment.unset('Admin_Current_Ticket');`,
});

// Publications (Brands)
const publications = folder('Publications (Brands)', [
    rpc('CreatePublications', 'CreatePublications', {
        RequestModes: [],
        Publications: [{
            Name: `PM Test Brand ${TAG}`,
            Description: 'Created by the Postman Administration test run',
            SortOrder: 0,
            EmailNotify: false,
            ReversedRead: false,
            AutoPurge: 0,
            CalculateDeadlines: false,
            __classname__: 'AdmPublication',
        }],
    }, {
        description: 'Creates a brand. Leave `Id` out on create; the server returns the new `Id`.\n\nOptional lists on `AdmPublication` (`PubChannels`, `Issues`, `Editions`, `Sections`, `Statuses`, `UserGroups`, `AdminGroups`, `Workflows`, `Routings`) are `AdmIdName` objects and are only filled on responses when the matching `RequestModes` are asked for.',
        test: capture('Publications', 'Adm_Pub_Id'),
    }),
    rpc('GetPublications', 'GetPublications', {
        RequestModes: ['GetPubChannels', 'GetIssues', 'GetEditions', 'GetSections', 'GetStatuses'],
        PublicationIds: [n('Adm_Pub_Id')],
    }, {
        description: 'Returns brands. Leave `PublicationIds` out (or pass `[]`) to get all brands. `RequestModes` controls which child lists are filled in on each `AdmPublication`.',
        test: expectIdIn('Publications', 'Adm_Pub_Id'),
    }),
    rpc('ModifyPublications', 'ModifyPublications', {
        RequestModes: [],
        Publications: [{
            Id: n('Adm_Pub_Id'),
            Name: `PM Test Brand ${TAG}`,
            Description: 'Modified by the Postman Administration test run',
            __classname__: 'AdmPublication',
        }],
    }, {
        description: 'Modifies brands identified by `Id`.',
        test: expectProp('Publications', 'Description', 'Modified by the Postman Administration test run'),
    }),
    rpc('CopyPublications', 'CopyPublications', {
        RequestModes: [],
        DuplicateIssues: true,
        SourcePubId: n('Adm_Pub_Id'),
        TargetPubs: [{
            Name: `PM Test Brand Copy ${TAG}`,
            Description: 'Copy made by the Postman Administration test run',
            __classname__: 'AdmPublication',
        }],
    }, {
        description: 'Copies the brand `SourcePubId` (with its channels, editions, sections, statuses and authorizations) into a new brand. With `DuplicateIssues` the issues are copied too.',
        test: capture('Publications', 'Adm_PubCopy_Id'),
    }),
]);

// Publication channels
const pubChannels = folder('PubChannels', [
    rpc('CreatePubChannels', 'CreatePubChannels', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
        PubChannels: [{
            Name: `PM Test Print Channel ${TAG}`,
            Type: 'print',
            Description: 'Created by the Postman Administration test run',
            SortOrder: 0,
            __classname__: 'AdmPubChannel',
        }],
    }, {
        description: '`Type` is one of `print`, `web`, `sms`, `dps2`, `other`. Set `PublishSystem` to route the channel to a publishing integration.',
        test: capture('PubChannels', 'Adm_Channel_Id'),
    }),
    rpc('GetPubChannels', 'GetPubChannels', {
        RequestModes: ['GetIssues', 'GetEditions'],
        PublicationId: n('Adm_Pub_Id'),
        PubChannelIds: [n('Adm_Channel_Id')],
    }, { test: expectIdIn('PubChannels', 'Adm_Channel_Id') }),
    rpc('ModifyPubChannels', 'ModifyPubChannels', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
        PubChannels: [{
            Id: n('Adm_Channel_Id'),
            Name: `PM Test Print Channel ${TAG}`,
            Type: 'print',
            Description: 'Modified by the Postman Administration test run',
            __classname__: 'AdmPubChannel',
        }],
    }, { test: expectProp('PubChannels', 'Description', 'Modified by the Postman Administration test run') }),
]);

// Issues
const issueFields = (name, extra = {}) => ({
    Name: name,
    Description: 'Created by the Postman Administration test run',
    SortOrder: 0,
    EmailNotify: false,
    ReversedRead: false,
    OverrulePublication: false,
    ExpectedPages: 16,
    Subject: 'Postman test issue',
    Activated: true,
    CalculateDeadlines: false,
    ...extra,
    __classname__: 'AdmIssue',
});

const issues = folder('Issues', [
    rpc('CreateIssues', 'CreateIssues', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
        PubChannelId: n('Adm_Channel_Id'),
        Issues: [issueFields(`PM Test Issue A ${TAG}`), issueFields(`PM Test Issue B ${TAG}`)],
    }, {
        description: 'Creates issues in a publication channel. Dates (`Deadline`, `PublicationDate`) use the `yyyy-mm-ddThh:mm:ss` format; leave them out when not needed.\n\nThis sample creates two issues: A is removed with `DeleteIssues`, B with `CleanAndDeleteIssues` in the Teardown folder.',
        test: `${capture('Issues', 'Adm_Issue_Id', 0)}\n${capture('Issues', 'Adm_Issue2_Id', 1)}`,
    }),
    rpc('GetIssues', 'GetIssues', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
        PubChannelId: n('Adm_Channel_Id'),
        IssueIds: [n('Adm_Issue_Id'), n('Adm_Issue2_Id')],
    }, {
        description: 'Leave `IssueIds` out to get all issues of the channel (or of the brand\'s default channel when `PubChannelId` is left out).',
        test: `${expectIdIn('Issues', 'Adm_Issue_Id')}\n${expectIdIn('Issues', 'Adm_Issue2_Id')}`,
    }),
    rpc('ModifyIssues', 'ModifyIssues', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
        PubChannelId: n('Adm_Channel_Id'),
        Issues: [{
            Id: n('Adm_Issue_Id'),
            Name: `PM Test Issue A ${TAG}`,
            Subject: 'Modified by the Postman Administration test run',
            ExpectedPages: 24,
            __classname__: 'AdmIssue',
        }],
    }, { test: expectProp('Issues', 'Subject', 'Modified by the Postman Administration test run') }),
    rpc('CopyIssues', 'CopyIssues', {
        RequestModes: [],
        IssueId: n('Adm_Issue_Id'),
        Issues: [{
            Name: `PM Test Issue Copy ${TAG}`,
            __classname__: 'AdmIssue',
        }],
    }, {
        description: 'Copies the issue `IssueId` into a new issue in the same channel. `Issues` holds the properties of the copy (at least `Name`).',
        test: capture('Issues', 'Adm_IssueCopy_Id'),
    }),
]);

// Editions
const editions = folder('Editions', [
    rpc('CreateEditions', 'CreateEditions', {
        PublicationId: n('Adm_Pub_Id'),
        PubChannelId: n('Adm_Channel_Id'),
        Editions: [{
            Name: `PM Test Edition ${TAG}`,
            Description: 'Created by the Postman Administration test run',
            SortOrder: 0,
            DeadlineRelative: 0,
            __classname__: 'AdmEdition',
        }],
    }, {
        description: 'Editions belong to a publication channel. Pass `IssueId` only for issues that overrule the brand (`OverrulePublication: true`).',
        test: capture('Editions', 'Adm_Edition_Id'),
    }),
    rpc('GetEditions', 'GetEditions', {
        PublicationId: n('Adm_Pub_Id'),
        PubChannelId: n('Adm_Channel_Id'),
        EditionIds: [n('Adm_Edition_Id')],
    }, { test: expectIdIn('Editions', 'Adm_Edition_Id') }),
    rpc('ModifyEditions', 'ModifyEditions', {
        PublicationId: n('Adm_Pub_Id'),
        PubChannelId: n('Adm_Channel_Id'),
        Editions: [{
            Id: n('Adm_Edition_Id'),
            Name: `PM Test Edition ${TAG}`,
            Description: 'Modified by the Postman Administration test run',
            __classname__: 'AdmEdition',
        }],
    }, { test: expectProp('Editions', 'Description', 'Modified by the Postman Administration test run') }),
]);

// Sections (categories)
const sections = folder('Sections', [
    rpc('CreateSections', 'CreateSections', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
        Sections: [{
            Name: `PM Test Section ${TAG}`,
            Description: 'Created by the Postman Administration test run',
            SortOrder: 0,
            ExpectedPages: 4,
            __classname__: 'AdmSection',
        }],
    }, {
        description: 'Sections are called Categories in the Studio UI. Pass `IssueId` only for issues that overrule the brand.',
        test: capture('Sections', 'Adm_Section_Id'),
    }),
    rpc('GetSections', 'GetSections', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
        SectionIds: [n('Adm_Section_Id')],
    }, { test: expectIdIn('Sections', 'Adm_Section_Id') }),
    rpc('ModifySections', 'ModifySections', {
        PublicationId: n('Adm_Pub_Id'),
        Sections: [{
            Id: n('Adm_Section_Id'),
            Name: `PM Test Section ${TAG}`,
            Description: 'Modified by the Postman Administration test run',
            __classname__: 'AdmSection',
        }],
    }, {
        description: 'Note: unlike most Modify calls, `ModifySectionsRequest` has no `RequestModes`.',
        test: expectProp('Sections', 'Description', 'Modified by the Postman Administration test run'),
    }),
]);

// Statuses
const status = (name, sortOrder, color, phase) => ({
    Name: name,
    SortOrder: sortOrder,
    Type: 'Article',
    Produce: false,
    Color: color,
    DeadlineRelative: 0,
    CreatePermanentVersion: false,
    RemoveIntermediateVersions: false,
    AutomaticallySendToNext: false,
    ReadyForPublishing: false,
    Phase: phase,
    SkipIdsa: false,
    SendToArchive: false,
    __classname__: 'AdmStatus',
});

const statuses = folder('Statuses', [
    rpc('CreateStatuses', 'CreateStatuses', {
        PublicationId: n('Adm_Pub_Id'),
        Statuses: [
            status(`PM Draft ${TAG}`, 1, '#A0A0A0', 'Production'),
            status(`PM Ready ${TAG}`, 2, '#00A000', 'Completed'),
        ],
    }, {
        description: 'Creates workflow statuses for one object `Type` (see `ObjectType` in the SDK). `Phase` is one of `Selection`, `Production`, `Completed`, `Archived`. `Color` is a hex RGB string.\n\n`NextStatus` (an `AdmIdName`) can only point to an existing status, so it is set in ModifyStatuses.',
        test: `${capture('Statuses', 'Adm_Status_Id', 0)}\n${capture('Statuses', 'Adm_Status2_Id', 1)}`,
    }),
    rpc('GetStatuses', 'GetStatuses', {
        PublicationId: n('Adm_Pub_Id'),
        ObjectType: 'Article',
    }, {
        description: 'Filter by `ObjectType`, or pass `StatusIds` to get specific statuses.',
        test: `${expectIdIn('Statuses', 'Adm_Status_Id')}\n${expectIdIn('Statuses', 'Adm_Status2_Id')}`,
    }),
    rpc('ModifyStatuses', 'ModifyStatuses', {
        Statuses: [{
            ...status(`PM Draft ${TAG}`, 1, '#808080', 'Production'),
            Id: n('Adm_Status_Id'),
            NextStatus: { Id: n('Adm_Status2_Id'), Name: `PM Ready ${TAG}`, __classname__: 'AdmIdName' },
        }],
    }, {
        description: 'Statuses are identified by `Id`, so the request has no `PublicationId`. This sample links the Draft status to the Ready status with `NextStatus`.',
        test: `
pm.test('NextStatus points to {{Adm_Status2_Id}}', () => {
    const st = (pm.response.json().result.Statuses || [])[0] || {};
    pm.expect(Number(st.NextStatus && st.NextStatus.Id)).to.eql(Number(pm.collectionVariables.get('Adm_Status2_Id')));
});`,
    }),
]);

// Users
const users = folder('Users', [
    rpc('CreateUsers', 'CreateUsers', {
        RequestModes: [],
        Users: [{
            Name: `pm_test_user_${TAG}`,
            FullName: `PM Test User ${TAG}`,
            Password: s('Test_User_Password'),
            Deactivated: false,
            FixedPassword: false,
            EmailAddress: 'pm.test.user@example.com',
            EmailUser: false,
            EmailGroup: false,
            Language: 'enUS',
            Organization: 'Postman',
            Location: 'Test',
            __classname__: 'AdmUser',
        }],
    }, {
        description: 'Creates users. The pre-request script generates a random password in `Test_User_Password` (deliberately not an `Adm_` variable: the folder skip check runs before this script).\n\nDates such as `ValidFrom`, `ValidTill` use the `yyyy-mm-ddThh:mm:ss` format. `LogLevel` is one of `NONE`, `ERROR`, `WARN`, `DEPRECATED`, `INFO`, `DEBUG`.',
        prerequest: `
const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let password = '';
for (let i = 0; i < 16; i++) password += chars[Math.floor(Math.random() * chars.length)];
pm.collectionVariables.set('Test_User_Password', password + '#7a');`,
        test: capture('Users', 'Adm_User_Id'),
    }),
    rpc('GetUsers', 'GetUsers', {
        RequestModes: ['GetUserGroups'],
        UserIds: [n('Adm_User_Id')],
    }, {
        description: 'Leave `UserIds` out to get all users, or pass `GroupId` to get the members of a group. With `RequestModes: ["GetUserGroups"]` each user includes its `UserGroups`.',
        test: expectIdIn('Users', 'Adm_User_Id'),
    }),
    rpc('ModifyUsers', 'ModifyUsers', {
        RequestModes: [],
        Users: [{
            Id: n('Adm_User_Id'),
            Name: `pm_test_user_${TAG}`,
            FullName: `PM Test User ${TAG} (modified)`,
            __classname__: 'AdmUser',
        }],
    }, {
        description: 'Modifies users identified by `Id`.',
        test: expectProp('Users', 'FullName', `PM Test User ${TAG} (modified)`),
    }),
]);

// User groups and memberships
const userGroups = folder('User Groups', [
    rpc('CreateUserGroups', 'CreateUserGroups', {
        RequestModes: [],
        UserGroups: [{
            Name: `pm_test_group_${TAG}`,
            Description: 'Created by the Postman Administration test run',
            Admin: false,
            Routing: true,
            __classname__: 'AdmUserGroup',
        }],
    }, {
        description: '`Admin: true` makes the members system administrators. `Routing: true` makes the group selectable as a route-to target.',
        test: capture('UserGroups', 'Adm_Group_Id'),
    }),
    rpc('GetUserGroups', 'GetUserGroups', {
        RequestModes: [],
        GroupIds: [n('Adm_Group_Id')],
    }, {
        description: 'Leave `GroupIds` out to get all groups, or pass `UserId` to get the groups of one user.',
        test: expectIdIn('UserGroups', 'Adm_Group_Id'),
    }),
    rpc('ModifyUserGroups', 'ModifyUserGroups', {
        RequestModes: [],
        UserGroups: [{
            Id: n('Adm_Group_Id'),
            Name: `pm_test_group_${TAG}`,
            Description: 'Modified by the Postman Administration test run',
            __classname__: 'AdmUserGroup',
        }],
    }, { test: expectProp('UserGroups', 'Description', 'Modified by the Postman Administration test run') }),
    rpc('AddUsersToGroup', 'AddUsersToGroup', {
        UserIds: [n('Adm_User_Id')],
        GroupId: n('Adm_Group_Id'),
    }, { description: 'Adds one or more users to one group.' }),
    rpc('GetUsers (members of group)', 'GetUsers', {
        RequestModes: [],
        GroupId: n('Adm_Group_Id'),
    }, {
        description: 'Checks that AddUsersToGroup worked by listing the members of the group.',
        test: expectIdIn('Users', 'Adm_User_Id'),
    }),
    rpc('RemoveUsersFromGroup', 'RemoveUsersFromGroup', {
        UserIds: [n('Adm_User_Id')],
        GroupId: n('Adm_Group_Id'),
    }, { description: 'Removes one or more users from one group.' }),
    rpc('AddGroupsToUser', 'AddGroupsToUser', {
        GroupIds: [n('Adm_Group_Id')],
        UserId: n('Adm_User_Id'),
    }, { description: 'Adds one user to one or more groups.' }),
    rpc('GetUserGroups (groups of user)', 'GetUserGroups', {
        RequestModes: [],
        UserId: n('Adm_User_Id'),
    }, {
        description: 'Checks that AddGroupsToUser worked by listing the groups of the user.',
        test: expectIdIn('UserGroups', 'Adm_Group_Id'),
    }),
    rpc('RemoveGroupsFromUser', 'RemoveGroupsFromUser', {
        GroupIds: [n('Adm_Group_Id')],
        UserId: n('Adm_User_Id'),
    }, { description: 'Removes one user from one or more groups.' }),
]);

// Access profiles
const feature = (name, value = 'Yes') => ({ Name: name, Value: value, __classname__: 'AdmProfileFeature' });
const FEATURES = ['View', 'Read', 'Write', 'Open_Edit', 'Delete', 'Change_Status', 'Download_Preview', 'Download_Original', 'ViewNotes', 'EditStickyNotes'];

const accessProfiles = folder('Access Profiles', [
    rpc('CreateAccessProfiles', 'CreateAccessProfiles', {
        RequestModes: [],
        AccessProfiles: [{
            Name: `PM Test Profile ${TAG}`,
            Description: 'Created by the Postman Administration test run',
            SortOrder: 0,
            ProfileFeatures: FEATURES.map(f => feature(f)),
            __classname__: 'AdmAccessProfile',
        }],
    }, {
        description: 'Creates access profiles. Each `AdmProfileFeature` needs a `Name` and a `Value` (`Yes` or `No`); features left out are off.\n\nTo see every valid feature name, call GetAccessProfiles with `RequestModes: ["GetProfileFeatures"]`.',
        test: capture('AccessProfiles', 'Adm_Profile_Id'),
    }),
    rpc('GetAccessProfiles', 'GetAccessProfiles', {
        RequestModes: ['GetProfileFeatures'],
        AccessProfileIds: [n('Adm_Profile_Id')],
    }, {
        description: 'Leave `AccessProfileIds` out to get all profiles. With `RequestModes: ["GetProfileFeatures"]` the features of each profile are included.',
        test: expectIdIn('AccessProfiles', 'Adm_Profile_Id'),
    }),
    rpc('ModifyAccessProfiles', 'ModifyAccessProfiles', {
        RequestModes: [],
        AccessProfiles: [{
            Id: n('Adm_Profile_Id'),
            Name: `PM Test Profile ${TAG}`,
            Description: 'Modified by the Postman Administration test run',
            ProfileFeatures: FEATURES.map(f => feature(f, f === 'Delete' ? 'No' : 'Yes')),
            __classname__: 'AdmAccessProfile',
        }],
    }, { test: expectProp('AccessProfiles', 'Description', 'Modified by the Postman Administration test run') }),
]);

// Workflow (brand) authorizations
const workflowAuth = folder('Workflow User Group Authorizations', [
    rpc('CreateWorkflowUserGroupAuthorizations', 'CreateWorkflowUserGroupAuthorizations', {
        PublicationId: n('Adm_Pub_Id'),
        WorkflowUserGroupAuthorizations: [{
            UserGroupId: n('Adm_Group_Id'),
            AccessProfileId: n('Adm_Profile_Id'),
            __classname__: 'AdmWorkflowUserGroupAuthorization',
        }],
    }, {
        description: 'Gives a user group an access profile on a brand (or on an overruling issue with `IssueId`). Leave `SectionId` and `StatusId` out to authorize all sections and statuses.',
        test: capture('WorkflowUserGroupAuthorizations', 'Adm_WflAuth_Id'),
    }),
    rpc('GetWorkflowUserGroupAuthorizations', 'GetWorkflowUserGroupAuthorizations', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
        UserGroupId: n('Adm_Group_Id'),
    }, {
        description: 'Filter by `UserGroupId` or `WorkflowUserGroupAuthorizationIds`. `RequestModes` `GetUserGroups`, `GetStatuses`, `GetSections` add the referenced objects to the response.',
        test: expectIdIn('WorkflowUserGroupAuthorizations', 'Adm_WflAuth_Id'),
    }),
    rpc('ModifyWorkflowUserGroupAuthorizations', 'ModifyWorkflowUserGroupAuthorizations', {
        PublicationId: n('Adm_Pub_Id'),
        WorkflowUserGroupAuthorizations: [{
            Id: n('Adm_WflAuth_Id'),
            UserGroupId: n('Adm_Group_Id'),
            SectionId: n('Adm_Section_Id'),
            StatusId: n('Adm_Status_Id'),
            AccessProfileId: n('Adm_Profile_Id'),
            __classname__: 'AdmWorkflowUserGroupAuthorization',
        }],
    }, {
        description: 'Narrows the authorization down to one section and one status.',
        test: `
pm.test('authorization now limited to {{Adm_Status_Id}}', () => {
    const auth = (pm.response.json().result.WorkflowUserGroupAuthorizations || [])[0] || {};
    pm.expect(Number(auth.StatusId)).to.eql(Number(pm.collectionVariables.get('Adm_Status_Id')));
});`,
    }),
]);

// Brand admin authorizations
const pubAdminAuth = folder('Publication Admin Authorizations', [
    rpc('CreatePublicationAdminAuthorizations', 'CreatePublicationAdminAuthorizations', {
        PublicationId: n('Adm_Pub_Id'),
        UserGroupIds: [n('Adm_Group_Id')],
    }, { description: 'Makes the members of the user groups brand administrators of the brand.' }),
    rpc('GetPublicationAdminAuthorizations', 'GetPublicationAdminAuthorizations', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
    }, {
        description: 'Returns the `UserGroupIds` of the brand admin groups. With `RequestModes: ["GetUserGroups"]` the full `UserGroups` are included too.',
        test: `
pm.test('UserGroupIds contains {{Adm_Group_Id}}', () => {
    const ids = (pm.response.json().result.UserGroupIds || []).map(Number);
    pm.expect(ids).to.include(Number(pm.collectionVariables.get('Adm_Group_Id')));
});`,
    }),
]);

// Routings
const routings = folder('Routings', [
    rpc('CreateRoutings', 'CreateRoutings', {
        PublicationId: n('Adm_Pub_Id'),
        Routings: [{
            SectionId: n('Adm_Section_Id'),
            StatusId: n('Adm_Status_Id'),
            RouteTo: `pm_test_user_${TAG}`,
            __classname__: 'AdmRouting',
        }],
    }, {
        description: 'Routing rules: objects of a section that reach a status are routed to `RouteTo` (a user name or the name of a user group with `Routing: true`). Leave `SectionId` or `StatusId` out to match all.',
        test: capture('Routings', 'Adm_Routing_Id'),
    }),
    rpc('GetRoutings', 'GetRoutings', {
        RequestModes: [],
        PublicationId: n('Adm_Pub_Id'),
    }, {
        description: 'Filter by `SectionId` or `RoutingIds`. `RequestModes` `GetSections` and `GetStatuses` add the referenced objects to the response.',
        test: expectIdIn('Routings', 'Adm_Routing_Id'),
    }),
    rpc('ModifyRoutings', 'ModifyRoutings', {
        PublicationId: n('Adm_Pub_Id'),
        Routings: [{
            Id: n('Adm_Routing_Id'),
            SectionId: n('Adm_Section_Id'),
            StatusId: n('Adm_Status_Id'),
            RouteTo: `pm_test_group_${TAG}`,
            __classname__: 'AdmRouting',
        }],
    }, {
        description: 'Routes to the test user group instead of the test user.',
        test: expectProp('Routings', 'RouteTo', `pm_test_group_${TAG}`),
    }),
]);

// Autocomplete (deprecated)
const termEntity = { Name: `PM Test Terms ${TAG}`, AutocompleteProvider: s('Adm_Autocomplete_Provider'), __classname__: 'AdmTermEntity' };
const autocomplete = folder('Autocomplete Terms (deprecated)', [
    rpc('CreateAutocompleteTermEntities', 'CreateAutocompleteTermEntities', { TermEntities: [termEntity] }, {
        test: capture('TermEntities', 'Adm_TermEntity_Id'),
    }),
    rpc('GetAutocompleteTermEntities', 'GetAutocompleteTermEntities', { AutocompleteProvider: s('Adm_Autocomplete_Provider') }, {
        test: expectIdIn('TermEntities', 'Adm_TermEntity_Id'),
    }),
    rpc('ModifyAutocompleteTermEntities', 'ModifyAutocompleteTermEntities', {
        TermEntities: [{ ...termEntity, Id: n('Adm_TermEntity_Id'), Name: `PM Test Terms ${TAG} (modified)` }],
    }),
    rpc('CreateAutocompleteTerms', 'CreateAutocompleteTerms', {
        TermEntity: { ...termEntity, Id: n('Adm_TermEntity_Id'), Name: `PM Test Terms ${TAG} (modified)` },
        Terms: ['pmalpha', 'pmbeta', 'pmgamma'],
    }),
    rpc('GetAutocompleteTerms', 'GetAutocompleteTerms', {
        TermEntity: { ...termEntity, Id: n('Adm_TermEntity_Id'), Name: `PM Test Terms ${TAG} (modified)` },
        TypedValue: 'pm',
        FirstEntry: 0,
        MaxEntries: 10,
    }, {
        test: `
pm.test('Terms contains pmalpha', () => {
    pm.expect(pm.response.json().result.Terms || []).to.include('pmalpha');
});`,
    }),
    rpc('ModifyAutocompleteTerms', 'ModifyAutocompleteTerms', {
        TermEntity: { ...termEntity, Id: n('Adm_TermEntity_Id'), Name: `PM Test Terms ${TAG} (modified)` },
        OldTerms: ['pmgamma'],
        NewTerms: ['pmdelta'],
    }),
    rpc('DeleteAutocompleteTerms', 'DeleteAutocompleteTerms', {
        TermEntity: { ...termEntity, Id: n('Adm_TermEntity_Id'), Name: `PM Test Terms ${TAG} (modified)` },
        Terms: ['pmalpha', 'pmbeta', 'pmdelta'],
    }),
    rpc('DeleteAutocompleteTermEntities', 'DeleteAutocompleteTermEntities', {
        TermEntities: [{ ...termEntity, Id: n('Adm_TermEntity_Id'), Name: `PM Test Terms ${TAG} (modified)` }],
    }),
], {
    description: 'The Administration autocomplete services are deprecated since Studio Server 10.70.0.\n\nThey need an autocomplete provider (a server plugin that implements the AutocompleteProvider connector). Set the `Adm_Autocomplete_Provider` collection variable to the provider name to run them; while it is empty these calls are skipped.',
});

// Teardown
const teardown = folder('Teardown (Delete calls)', [
    rpc('DeleteRoutings', 'DeleteRoutings', {
        RoutingIds: [n('Adm_Routing_Id')],
    }, { description: 'Deletes routings either by `RoutingIds` **or** by filters (`PublicationId` / `IssueId` / `SectionId`), not both: the server rejects a mix ("Either routing ids or filters (brand/section) should be used, not both"). Filters delete every matching routing, so pass IDs unless that is what you want.' }),
    rpc('DeletePublicationAdminAuthorizations', 'DeletePublicationAdminAuthorizations', {
        PublicationId: n('Adm_Pub_Id'),
        UserGroupIds: [n('Adm_Group_Id')],
    }, { description: 'Leaving `UserGroupIds` out removes all brand admin groups of the brand.' }),
    rpc('DeleteWorkflowUserGroupAuthorizations', 'DeleteWorkflowUserGroupAuthorizations', {
        WorkflowUserGroupAuthorizationIds: [n('Adm_WflAuth_Id')],
    }, { description: 'Deletes authorizations either by `WorkflowUserGroupAuthorizationIds` **or** by filters (`PublicationId` / `IssueId` / `UserGroupId`), not both: the server rejects a mix ("Either authorization ids or filters (brand/user group) should be used, not both"). Filters delete every matching authorization.' }),
    rpc('DeleteAccessProfiles', 'DeleteAccessProfiles', {
        AccessProfileIds: [n('Adm_Profile_Id')],
    }),
    rpc('DeleteUserGroups', 'DeleteUserGroups', {
        GroupIds: [n('Adm_Group_Id')],
    }),
    rpc('DeleteUsers', 'DeleteUsers', {
        UserIds: [n('Adm_User_Id')],
    }),
    rpc('DeleteStatuses', 'DeleteStatuses', {
        StatusIds: [n('Adm_Status_Id'), n('Adm_Status2_Id')],
    }),
    rpc('DeleteSections', 'DeleteSections', {
        PublicationId: n('Adm_Pub_Id'),
        SectionIds: [n('Adm_Section_Id')],
    }),
    rpc('DeleteEditions', 'DeleteEditions', {
        PublicationId: n('Adm_Pub_Id'),
        PubChannelId: n('Adm_Channel_Id'),
        EditionIds: [n('Adm_Edition_Id')],
    }),
    rpc('CleanAndTrashIssues', 'CleanAndTrashIssues', {
        IssueIds: [n('Adm_IssueCopy_Id')],
    }, {
        description: 'Moves all objects that are only assigned to the issues to the Trash Can, then deletes the issues. `Reports` lists objects that could not be moved.',
        test: `
pm.test('IssueIds contains {{Adm_IssueCopy_Id}}', () => {
    const ids = (pm.response.json().result.IssueIds || []).map(Number);
    pm.expect(ids).to.include(Number(pm.collectionVariables.get('Adm_IssueCopy_Id')));
});`,
    }),
    rpc('CleanAndDeleteIssues', 'CleanAndDeleteIssues', {
        IssueIds: [n('Adm_Issue2_Id')],
    }, {
        description: 'Permanently deletes all objects that are only assigned to the issues, then deletes the issues. `Reports` lists objects that could not be deleted.',
        test: `
pm.test('IssueIds contains {{Adm_Issue2_Id}}', () => {
    const ids = (pm.response.json().result.IssueIds || []).map(Number);
    pm.expect(ids).to.include(Number(pm.collectionVariables.get('Adm_Issue2_Id')));
});`,
    }),
    rpc('DeleteIssues', 'DeleteIssues', {
        PublicationId: n('Adm_Pub_Id'),
        IssueIds: [n('Adm_Issue_Id')],
    }, { description: 'Deletes issues that have no objects assigned. Use CleanAndDeleteIssues or CleanAndTrashIssues for issues that still hold objects.' }),
    rpc('DeletePubChannels', 'DeletePubChannels', {
        PublicationId: n('Adm_Pub_Id'),
        PubChannelIds: [n('Adm_Channel_Id')],
    }),
    rpc('DeletePublications', 'DeletePublications', {
        PublicationIds: [n('Adm_PubCopy_Id'), n('Adm_Pub_Id')],
    }, { description: 'Deletes brands, including their channels, issues, editions, sections, statuses and authorizations.' }),
    rpc('GetPublications (verify teardown)', 'GetPublications', {
        RequestModes: [],
    }, {
        description: 'Lists all brands and checks that the test brands are gone.',
        test: `
pm.test('test brands were deleted', () => {
    const ids = (pm.response.json().result.Publications || []).map(p => Number(p.Id));
    ['Adm_Pub_Id', 'Adm_PubCopy_Id'].forEach(name => {
        pm.expect(ids, name).to.not.include(Number(pm.collectionVariables.get(name)));
    });
});`,
    }),
], {
    description: 'Deletes everything the folders above created, in reverse dependency order. Each call only uses the `Adm_*` IDs captured by the Create calls; a call is skipped when an ID it needs is not set.',
});

export const administration = folder('Administration', [
    logOn,
    publications,
    pubChannels,
    issues,
    editions,
    sections,
    statuses,
    users,
    userGroups,
    accessProfiles,
    workflowAuth,
    pubAdminAuth,
    routings,
    autocomplete,
    teardown,
    logOff,
], {
    description: [
        'Administration interface (`adminindex.php`) calls, one per SDK service.',
        '',
        '**Running it as a test.** The folder runs top to bottom as a create → get → modify → delete cycle on a throw-away brand, user, group and access profile. Run it with the Postman Collection Runner or Newman against a test server. `LogOn - Administration` stores the ticket; each Create call stores the new ID in an `Adm_*` collection variable that later calls use; the Teardown folder removes everything again.',
        '',
        '**Environment variables used:** `Studio_Server_URL`, `Studio_Server_Directory`, `Admin_User_Name`, `Admin_User_Password`, `Admin_Current_Ticket` (set by LogOn).',
        '',
        '**Body conventions** (checked against the TypeScript SDK in `sdk/typescript/adm/index.d.ts`):',
        '- `params` is an array holding one request object: `"params": [{ ... }]`.',
        '- Every nested object needs its `__classname__` (`AdmPublication`, `AdmUser`, `AdmIdName`, ...). Without it the server receives a plain array instead of a typed object.',
        '- ID fields are numbers. Leave optional fields out instead of sending `""` or `null`.',
        '- `RequestModes` values must be valid `Mode` values (`GetPublications`, `GetPubChannels`, `GetIssues`, `GetEditions`, `GetSections`, `GetStatuses`, `GetUsers`, `GetUserGroups`, `GetProfileFeatures`, `GetObjectInfos`), or an empty array.',
    ].join('\n'),
    prerequest: GUARD_PREREQUEST,
    test: RPC_TEST,
});

export const systemAdministration = folder('System Administration', [
    rpc('LogOn - Administration', 'LogOn', logOnFields(), {
        ticket: false,
        description: 'Same as Administration > LogOn - Administration; included so this folder can be run on its own. The System Administration interface accepts the Administration ticket.',
        test: logOn.event.find(e => e.listen === 'test').script.exec,
    }),
    sysRpc('GetSubApplications', 'GetSubApplications', {}, {
        description: 'Lists the sub-applications (Studio apps and plugins with a client part) installed on the server. Set `ClientAppName` to filter on one client application.',
        test: `
pm.test('SubApplications is an array', () => {
    pm.expect(pm.response.json().result.SubApplications).to.be.an('array');
});`,
    }),
], {
    description: 'System Administration interface (`sysadminindex.php`).',
    test: RPC_TEST,
});

export function logOnFields() {
    return {
        AdminUser: s('Admin_User_Name'),
        Password: s('Admin_User_Password'),
        ClientName: 'postman',
        ClientAppName: 'postman_sample_admin_request',
        ClientAppVersion: '1.0',
    };
}

