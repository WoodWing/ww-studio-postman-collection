// Test fixtures, created through the Administration interface, for the Workflow and Planning test runs:
// a throw-away brand (with channel, issues, edition, section and statuses), an access profile with all features,
// and a user group that gives the workflow user ({{User_Name}}) access to the brand.
import { capture, captureExpr, folder, n, raw, rpcBuilder, s, startRun, storeTicket } from '../lib/postman.mjs';

const wfl = rpcBuilder('wfl', 'Current_Ticket');
import { logOnFields } from './administration.mjs';

const adm = rpcBuilder('adm', 'Admin_Current_Ticket');

/** Names of the fixture entities for a prefix (P = 'Wfl' or 'Pln'). */
export function fixtureNames(P, label) {
    const tag = s(`${P}_Run_Tag`);
    return {
        brand: `PM ${label} Brand ${tag}`,
        channel: `PM ${label} Print ${tag}`,
        issue: `PM ${label} Issue A ${tag}`,
        issue2: `PM ${label} Issue B ${tag}`,
        edition: `PM ${label} Edition ${tag}`,
        section: `PM ${label} Section ${tag}`,
        status: (type, i) => `PM ${type} ${i === 0 ? 'Draft' : 'Ready'} ${tag}`,
        profile: `PM ${label} Profile ${tag}`,
        group: `pm_${label.toLowerCase()}_group_${tag}`,
    };
}

/** Variable name of the i-th status of an object type, e.g. Wfl_ArticleStatus_Id, Wfl_ArticleStatus2_Id. */
export const statusVar = (P, type, i = 0) => `${P}_${type}Status${i ? i + 1 : ''}_Id`;

/**
 * @param {string} P variable prefix
 * @param {string} label name label
 * @param {{type: string, count: number}[]} statusTypes statuses to create per object type (count 2 links Draft -> Ready)
 */
export function fixtureSetup(P, label, statusTypes) {
    const N = fixtureNames(P, label);
    const statuses = statusTypes.flatMap(({ type, count }) => Array.from({ length: count }, (_, i) => ({ type, i })));
    const status = ({ type, i }) => ({
        Name: N.status(type, i),
        SortOrder: i + 1,
        Type: type,
        Produce: false,
        Color: i === 0 ? '#A0A0A0' : '#00A000',
        Phase: i === 0 ? 'Production' : 'Completed',
        __classname__: 'AdmStatus',
    });
    const linked = statusTypes.filter(t => t.count > 1);

    return folder('00 Setup: test brand (Administration interface)', [
        adm('LogOn - Administration', 'LogOn', logOnFields(), {
            ticket: false,
            description: `Logs on as the admin user and starts a new ${P} test run (clears the ${P}_* IDs, sets ${P}_Run_Tag).`,
            prerequest: startRun(P),
            test: storeTicket('Admin_Current_Ticket'),
        }),
        adm('GetUsers (find workflow user)', 'GetUsers', { RequestModes: [] }, {
            description: `Finds the user {{User_Name}} (the user the workflow calls log on with) and stores its Id in ${P}_User_Id.`,
            test: captureExpr(
                `(result.Users || []).find(u => String(u.Name).toLowerCase() === String(pm.variables.get('User_Name')).toLowerCase()).Id`,
                `${P}_User_Id`, 'Id of user {{User_Name}}'),
        }),
        adm('GetAccessProfiles (feature names)', 'GetAccessProfiles', { RequestModes: ['GetProfileFeatures'] }, {
            description: `Collects the names of all profile features, so the test access profile can switch every feature on. Stored as JSON in ${P}_Profile_Features.`,
            test: `
const result = pm.response.json().result || {};
const names = new Set();
// ProfileFeatures (and AccessProfiles) may come back as an object keyed by name/ID instead of an array.
const list = v => (Array.isArray(v) ? v : Object.values(v || {}));
list(result.AccessProfiles).forEach(p => list(p.ProfileFeatures).forEach(f => names.add(f.Name)));
if (!names.size) ['View', 'Read', 'Write', 'Open_Edit', 'Delete', 'Purge', 'Change_Status', 'Change_Status_Forward', 'Restore_Version', 'Keep_Locked', 'Download_Preview', 'Download_Original', 'ViewNotes', 'EditStickyNotes', 'DeleteNotes', 'Create_Tasks', 'CreateDossier', 'AbortCheckOut'].forEach(f => names.add(f));
const features = [...names].map(name => ({ Name: name, Value: 'Yes', __classname__: 'AdmProfileFeature' }));
pm.collectionVariables.set('${P}_Profile_Features', JSON.stringify(features));
pm.test(features.length + ' profile feature names collected', () => pm.expect(features.length).to.be.above(0));`,
        }),
        adm('CreatePublications', 'CreatePublications', {
            RequestModes: [],
            Publications: [{ Name: N.brand, Description: `Postman ${label} test run`, __classname__: 'AdmPublication' }],
        }, { test: capture('Publications', `${P}_Pub_Id`) }),
        adm('CreatePubChannels', 'CreatePubChannels', {
            RequestModes: [],
            PublicationId: n(`${P}_Pub_Id`),
            PubChannels: [{ Name: N.channel, Type: 'print', __classname__: 'AdmPubChannel' }],
        }, { test: capture('PubChannels', `${P}_Channel_Id`) }),
        adm('CreateIssues', 'CreateIssues', {
            RequestModes: [],
            PublicationId: n(`${P}_Pub_Id`),
            PubChannelId: n(`${P}_Channel_Id`),
            Issues: [
                { Name: N.issue, Activated: true, __classname__: 'AdmIssue' },
                { Name: N.issue2, Activated: true, __classname__: 'AdmIssue' },
            ],
        }, { test: `${capture('Issues', `${P}_Issue_Id`, 0)}\n${capture('Issues', `${P}_Issue2_Id`, 1)}` }),
        adm('CreateEditions', 'CreateEditions', {
            PublicationId: n(`${P}_Pub_Id`),
            PubChannelId: n(`${P}_Channel_Id`),
            Editions: [{ Name: N.edition, __classname__: 'AdmEdition' }],
        }, { test: capture('Editions', `${P}_Edition_Id`) }),
        adm('CreateSections', 'CreateSections', {
            RequestModes: [],
            PublicationId: n(`${P}_Pub_Id`),
            Sections: [{ Name: N.section, __classname__: 'AdmSection' }],
        }, { test: capture('Sections', `${P}_Section_Id`) }),
        adm('CreateStatuses', 'CreateStatuses', {
            PublicationId: n(`${P}_Pub_Id`),
            Statuses: statuses.map(status),
        }, { test: statuses.map((st, idx) => capture('Statuses', statusVar(P, st.type, st.i), idx)).join('\n') }),
        ...(linked.length ? [adm('ModifyStatuses (link Draft to Ready)', 'ModifyStatuses', {
            Statuses: linked.map(({ type }) => ({
                ...status({ type, i: 0 }),
                Id: n(statusVar(P, type, 0)),
                NextStatus: { Id: n(statusVar(P, type, 1)), Name: N.status(type, 1), __classname__: 'AdmIdName' },
            })),
        }, { description: 'Sets NextStatus so SendToNext has somewhere to go.' })] : []),
        adm('CreateAccessProfiles (all features)', 'CreateAccessProfiles', {
            RequestModes: [],
            AccessProfiles: [{ Name: N.profile, ProfileFeatures: raw(`${P}_Profile_Features`), __classname__: 'AdmAccessProfile' }],
        }, { test: capture('AccessProfiles', `${P}_Profile_Id`) }),
        adm('CreateUserGroups', 'CreateUserGroups', {
            RequestModes: [],
            UserGroups: [{ Name: N.group, Admin: false, Routing: true, __classname__: 'AdmUserGroup' }],
        }, { test: capture('UserGroups', `${P}_Group_Id`) }),
        adm('AddUsersToGroup (workflow user)', 'AddUsersToGroup', {
            UserIds: [n(`${P}_User_Id`)],
            GroupId: n(`${P}_Group_Id`),
        }),
        adm('CreateWorkflowUserGroupAuthorizations', 'CreateWorkflowUserGroupAuthorizations', {
            PublicationId: n(`${P}_Pub_Id`),
            WorkflowUserGroupAuthorizations: [{
                UserGroupId: n(`${P}_Group_Id`),
                AccessProfileId: n(`${P}_Profile_Id`),
                __classname__: 'AdmWorkflowUserGroupAuthorization',
            }],
        }, {
            description: 'Gives the test group (with {{User_Name}} in it) the all-features profile on the test brand.',
            test: capture('WorkflowUserGroupAuthorizations', `${P}_WflAuth_Id`),
        }),
    ], {
        description: `Creates the throw-away brand and authorizations the ${label} calls below work on. Needs the admin user (Admin_User_Name) and the workflow user (User_Name) in the environment. The Teardown folder at the end removes all of it again.`,
    });
}

export function fixtureTeardown(P) {
    return folder('99 Teardown: test brand (Administration interface)', [
        wfl('LogOn (Workflow, for the object purge)', 'LogOn', {
            User: s('User_Name'),
            Password: s('Password'),
            ClientName: 'postman',
            ClientAppName: 'postman_sample_requests',
            RequestInfo: [],
        }, {
            ticket: false,
            description: 'A brand that still holds objects cannot be deleted, so the teardown first removes any objects that are left in the test brand (for example after a failed run). Note: logging off one session of a user can invalidate the other sessions of that user, so this Workflow session is only closed at the very end.',
            test: storeTicket('Current_Ticket'),
        }),
        wfl('QueryObjects (purge objects left in the test brand)', 'QueryObjects', {
            Params: [{ Property: 'PublicationId', Operation: '=', Value: s(`${P}_Pub_Id`), __classname__: 'QueryParam' }],
            MinimalProps: ['ID', 'Type', 'Name'],
            RequestProps: ['ID', 'Type', 'Name'],
            Areas: ['Workflow'],
        }, {
            description: 'Finds the objects left in the test brand (Workflow area, then the Trash Can) and deletes them permanently with DeleteObjects, sent from the test script with `pm.sendRequest`.',
            test: `
const url = pm.request.url.toString();
const ticket = pm.environment.get('Current_Ticket');
const pubId = String(pm.collectionVariables.get('${P}_Pub_Id'));
const rpcCall = (method, params) => new Promise((resolve, reject) => pm.sendRequest({
    url, method: 'POST', header: { 'Content-Type': 'application/json' },
    body: { mode: 'raw', raw: JSON.stringify({ method, id: '1', jsonrpc: '2.0', params: [{ Ticket: ticket, ...params, __classname__: 'Wfl' + method + 'Request' }] }) },
}, (err, res) => (err ? reject(err) : resolve(res.json()))));
const idsOf = result => {
    const col = (result.Columns || []).findIndex(c => c.Name === 'ID');
    return col < 0 ? [] : (result.Rows || []).map(r => r[col]);
};
(async () => {
    const leftovers = { Workflow: idsOf(pm.response.json().result || {}) };
    const trash = await rpcCall('QueryObjects', {
        Params: [{ Property: 'PublicationId', Operation: '=', Value: pubId, __classname__: 'QueryParam' }],
        MinimalProps: ['ID'], RequestProps: ['ID'], Areas: ['Trash'],
    });
    leftovers.Trash = idsOf(trash.result || {});
    for (const area of ['Workflow', 'Trash']) {
        if (!leftovers[area].length) continue;
        console.warn('Purging ' + leftovers[area].length + ' object(s) from ' + area + ': ' + leftovers[area].join(', '));
        const res = await rpcCall('DeleteObjects', { IDs: leftovers[area], Permanent: true, Areas: [area] });
        pm.test('purged objects from ' + area, () => pm.expect(res.error, JSON.stringify(res.error)).to.be.undefined);
    }
})();`,
        }),
        adm('LogOn - Administration', 'LogOn', logOnFields(), {
            ticket: false,
            description: 'Logs on again, in case the admin ticket expired during the run.',
            test: storeTicket('Admin_Current_Ticket'),
        }),
        adm('RemoveUsersFromGroup', 'RemoveUsersFromGroup', { UserIds: [n(`${P}_User_Id`)], GroupId: n(`${P}_Group_Id`) }),
        adm('DeleteUserGroups', 'DeleteUserGroups', { GroupIds: [n(`${P}_Group_Id`)] }),
        adm('DeleteAccessProfiles', 'DeleteAccessProfiles', { AccessProfileIds: [n(`${P}_Profile_Id`)] }),
        adm('DeletePublications', 'DeletePublications', { PublicationIds: [n(`${P}_Pub_Id`)] }, {
            description: 'Deletes the test brand with its channel, issues, edition, section, statuses and authorizations.',
        }),
        adm('GetPublications (verify teardown)', 'GetPublications', { RequestModes: [] }, {
            test: `
pm.test('test brand was deleted', () => {
    const ids = (pm.response.json().result.Publications || []).map(p => String(p.Id));
    pm.expect(ids).to.not.include(String(pm.collectionVariables.get('${P}_Pub_Id')));
});`,
        }),
        wfl('LogOff (Workflow)', 'LogOff', {}, { test: `pm.environment.unset('Current_Ticket');` }),
    ], { description: 'Purges any objects left in the test brand, then removes the brand, access profile and group created by the Setup folder.' });
}
