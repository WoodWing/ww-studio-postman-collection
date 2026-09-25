// Webhooks (legacy plug-in, SDK in server/plugins/Webhooks/sdk) and Connect Webhooks (its successor) folders.
// Both use pluginindex.php?plugin=<plugin>&interface=reg and a Workflow ticket.
import {
    captureExpr, expectEquals, expectIncludes, folder, GUARD_PREREQUEST, n, RPC_TEST, rpcBuilder, s, startRun, storeTicket,
} from '../lib/postman.mjs';

const wfl = rpcBuilder('wfl', 'Current_Ticket');

export const variables = {
    Wh_Run_Tag: '',
    Wh_Target_Url: 'https://example.com/studio-webhook-test',
    Cwh_Run_Tag: '',
    Cwh_Target_Url: 'https://example.com/studio-connect-webhook-test',
};

function logOn(P) {
    return wfl('LogOn', 'LogOn', {
        User: s('User_Name'),
        Password: s('Password'),
        ClientName: 'postman',
        ClientAppName: 'postman_sample_requests',
        ClientAppVersion: '1.0',
        RequestInfo: ['ServerInfo'],
    }, {
        ticket: false,
        description: `Workflow LogOn; the webhook registration calls use the Workflow ticket (\`Current_Ticket\`). Also starts a new ${P} test run.`,
        prerequest: startRun(P),
        test: storeTicket('Current_Ticket'),
    });
}

const logOff = wfl('LogOff', 'LogOff', {}, { test: `pm.environment.unset('Current_Ticket');` });

/**
 * @param {string} P variable prefix (Wh / Cwh)
 * @param {string} ns rpc namespace (whreg / cwhreg)
 * @param {string} cls classname prefix (WhReg / CwhReg)
 * @param {boolean} numericIds registration IDs are numbers (Webhooks) or UUID strings (Connect Webhooks)
 */
function registrationCalls(P, ns, cls, numericIds, extraUpdate = {}) {
    const rpc = rpcBuilder(ns, 'Current_Ticket');
    const id = numericIds ? n(`${P}_Registration_Id`) : s(`${P}_Registration_Id`);
    const TAG = s(`${P}_Run_Tag`);
    const trigger = { EntityName: s(`${P}_Entity`), EventTypes: [s(`${P}_EventType`)], __classname__: `${cls}Trigger` };
    return [
        rpc('GetTriggerOptions', 'GetTriggerOptions', {}, {
            description: `Lists the entities and event types a webhook can be triggered by. The test script keeps the first entity and event type in \`${P}_Entity\` and \`${P}_EventType\`.`,
            test: `${captureExpr('result.Options[0].Entity.Name', `${P}_Entity`, 'first entity')}\n${captureExpr('result.Options[0].EventTypes[0].Name', `${P}_EventType`, 'first event type')}`,
        }),
        rpc('CreateWebhookRegistration', 'CreateWebhookRegistration', {
            Registration: {
                Name: `pm-test-${TAG}`,
                Url: s(`${P}_Target_Url`),
                Triggers: [trigger],
                __classname__: `${cls}WebhookRegistrationInfo`,
            },
        }, {
            description: `Registers a webhook: Studio POSTs the event payload to \`Url\` for every trigger. Set \`SecretToken\` to have the payload signed. The test run posts to \`${P}_Target_Url\` (example.com by default); point it at e.g. a webhook.site URL to see the calls arrive.`,
            test: captureExpr('result.Registration.Id', `${P}_Registration_Id`, 'Registration.Id')
                + (extraUpdate.SystemId ? `\n${captureExpr('result.Registration.SystemId', `${P}_System_Id`, 'Registration.SystemId')}` : ''),
        }),
        rpc('ListWebhookRegistrations', 'ListWebhookRegistrations', {}, {
            test: expectIncludes('result.Registrations', `${P}_Registration_Id`, 'r => r.Id', 'Registrations'),
        }),
        rpc('GetWebhookRegistration', 'GetWebhookRegistration', { Id: id }, {
            description: 'Get a registration by `Id` (or by `Name`).',
            test: expectEquals('result.Registration.Name', `pm-test-${TAG}`, 'Registration.Name'),
        }),
        rpc('UpdateWebhookRegistration', 'UpdateWebhookRegistration', {
            Registration: {
                Id: id,
                Name: `pm-test-${TAG}-updated`,
                Url: s(`${P}_Target_Url`),
                Triggers: [trigger],
                ...extraUpdate,
                __classname__: `${cls}WebhookRegistrationInfo`,
            },
        }, {
            description: 'Replaces a registration (all fields, including `Triggers`).' + (extraUpdate.SystemId ? ' Connect Webhooks also requires the `SystemId` that Create returned ("ConnectWebhooks registration SystemId should be provided").' : ''),
            test: expectEquals('result.Registration.Name', `pm-test-${TAG}-updated`, 'Registration.Name'),
        }),
        rpc('DeleteWebhookRegistration', 'DeleteWebhookRegistration', { Id: id }),
        rpc('ListWebhookRegistrations (verify delete)', 'ListWebhookRegistrations', {}, {
            test: `pm.test('registration was deleted', () => {
    const ids = (pm.response.json().result.Registrations || []).map(r => String(r.Id));
    pm.expect(ids).to.not.include(String(pm.collectionVariables.get('${P}_Registration_Id')));
});`,
        }),
    ];
}

// The build reads the folder descriptions from its input collection, which may be an earlier build: drop the
// generated "Running it as a test" paragraph so rebuilding does not add it twice.
const withoutTestNote = description => (description || '').split('\n\n**Running it as a test.**')[0] || undefined;

export function webhooks(description) {
    description = withoutTestNote(description);
    return folder('Webhooks', [logOn('Wh'), ...registrationCalls('Wh', 'whreg', 'WhReg', true), logOff], {
        description: [
            description,
            '',
            '**Running it as a test.** Logs on, reads the trigger options, creates a registration for the first entity/event type, lists, gets, updates and deletes it, and logs off. Needs the Webhooks server plug-in to be enabled. Registration IDs are integers.',
        ].filter(x => x !== undefined).join('\n'),
        prerequest: GUARD_PREREQUEST,
        test: RPC_TEST,
    });
}

export function connectWebhooks(description) {
    description = withoutTestNote(description);
    return folder('Connect Webhooks', [
        logOn('Cwh'),
        ...registrationCalls('Cwh', 'cwhreg', 'CwhReg', false, { SystemId: s('Cwh_System_Id'), Enabled: false }),
        logOff,
    ], {
        description: [
            description,
            '',
            '**Running it as a test.** Same cycle as the Webhooks folder. Needs the Connect Webhooks plug-in (Studio cloud). Registration IDs are UUID strings. There is no SDK for this plug-in in the Studio Server download, so these bodies follow the plug-in\'s responses rather than a checked schema.',
        ].filter(x => x !== undefined).join('\n'),
        prerequest: GUARD_PREREQUEST,
        test: RPC_TEST,
    });
}
