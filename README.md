# Introduction
This is a Postman collection for working with WoodWing Studio Server. It covers **every service** of the Studio Server JSON-RPC interfaces:

| Interface | Entry point | Services | Folder |
|---|---|---|---|
| Workflow | `index.php` | 78 | Workflow |
| Administration | `adminindex.php` | 65 | Administration |
| System Administration | `sysadminindex.php` | 1 | System Administration |
| Planning | `editorialplan.php` | 8 | Planning |
| Webhooks plug-in (legacy) | `pluginindex.php?plugin=Webhooks&interface=reg` | 6 | Webhooks |
| Connect Webhooks plug-in | `pluginindex.php?plugin=ConnectWebhooks&interface=reg` | 6 | Connect Webhooks |

Every request body is checked against the Studio Server TypeScript SDK (`sdk/typescript` in the Studio Server download), and the Workflow, Administration, System Administration, Planning and webhook folders have been run as tests against a live Studio Server 10.70 (Studio cloud). All of the Studio API documentation can be found in the SDK docs.

Each folder does two jobs:
- **Reference.** Every request has a description with the options that matter (enum values, which fields are optional, server behaviour that is not in the SDK).
- **Test.** Each folder runs top to bottom, in the Postman Collection Runner or with Newman, as a self-cleaning test cycle. It creates its own throw-away data, exercises the calls with test scripts, and removes everything again. See [Running the tests](#running-the-tests).

> **Use a test server for test runs.** The runs create and delete brands, users, user groups, access profiles, objects and webhook registrations. Everything they create is named `PM …` / `pm_…` and is removed again at the end of the run.

# Repository contents

| File | What it is |
|---|---|
| `WoodWing Studio.postman_collection.json` | The collection. |
| `Studio Server Environment.postman_environment.json` | A Postman environment with all variables the collection uses (values empty). Import it and fill in your server and users. |
| `tools/` | Node.js scripts to lint the collection against the SDK, regenerate it, and run the tests with Newman. See [tools](#tools). |

# Getting started

1. Import `WoodWing Studio.postman_collection.json` and `Studio Server Environment.postman_environment.json` into Postman, and select the **WoodWing Studio** environment.
2. Fill in at least `Studio_Server_URL`, `Studio_Server_Directory`, `User_Name`, `Password`, `Admin_User_Name` and `Admin_User_Password`.
3. Send one of the **LogOn** requests. Its test script stores the ticket in the environment (`Current_Ticket`, `Admin_Current_Ticket` or `Planning_Ticket`); all other requests use it.

**Server URL.** The requests go to `{{Studio_Server_URL}}/{{Studio_Server_Directory}}/index.php`. For an on-premise server that is typically `https://studio.example.com` + `StudioServer`; for **Studio cloud** it is `https://<tenant>.woodwing.cloud` + `server`. Do not end `Studio_Server_URL` with a slash.

# Variables

## Environment
| Variable | Used for |
|---|---|
| `Studio_Server_URL` | Server address, without trailing slash, e.g. `https://studio.example.com`. |
| `Studio_Server_Directory` | Path after the address, e.g. `StudioServer` (on-premise) or `server` (Studio cloud). |
| `User_Name`, `Password` | The workflow user (Workflow, Planning and webhook folders). |
| `Current_Ticket` | Workflow ticket, set by the Workflow LogOn requests. |
| `Admin_User_Name`, `Admin_User_Password` | An admin user (Administration and System Administration folders, and the Setup/Teardown folders of the Workflow and Planning test runs). |
| `Admin_Current_Ticket` | Administration ticket, set by `LogOn - Administration`. |
| `Planning_Ticket` | Planning ticket, set by `LogOn - Planning`. |
| `Publication_Id`, `PubChannel_Id`, `Issue_Id`, `Edition_Id`, `Section_Id`, `Status_Id`, `User_Id`, `UserGroup_Id`, `AccessProfile_Id`, `WorkflowAuth_Id`, `Routing_Id`, `Object_Id` | IDs of your own entities, for sending requests by hand (the Digital Articles and Print Articles flows use `Publication_Id`, `Section_Id` and `Status_Id`). |
| `Component_Set_Id` | ID of a component set on your server, for `CreateObjects Digital Article`. |
| `Uuid_For_PUT` | File GUID of the Transfer Server upload in the Digital/Print Articles flows (set by the upload request). |
| `Pln_Template_Source_Id` | Optional: object ID of any layout template on your server. The Planning test copies it into its test brand so it can create a layout and adverts; without it those steps are skipped. |

Variable naming: IDs end in `_Id` (as in the SDK field names). Variables that a test run sets itself are collection variables, prefixed per folder: `Adm_` (Administration), `Wfl_` (Workflow), `Pln_` (Planning), `Wh_` (Webhooks), `Cwh_` (Connect Webhooks).

## Collection variables for the optional samples
Some requests need server configuration or objects the test data cannot provide. They are skipped until you set the variables they use (per request, see its description). Examples:

| Variable(s) | Enables |
|---|---|
| `Adm_Autocomplete_Provider` | Administration autocomplete calls (deprecated since 10.70; need an autocomplete provider plug-in). |
| `Wfl_WebApp_Url`, `Wfl_Native_App_Protocol` + `Wfl_Code_Challenge`, `Wfl_Tenant_Auth_Token` | Single sign-on and cloud tenant calls. |
| `Wfl_AI_Prompt_Type`, `Wfl_Spelling_Language`, `Wfl_Autocomplete_*`, `Wfl_Suggestion_Provider`, `Wfl_External_Property`, `Wfl_Custom_Property` | AI prompts, spelling, autocomplete, suggestions, external and custom properties. |
| `Wfl_Template_Id`, `Wfl_Layout_Id` + `Wfl_Layout_Version` (+ `Wfl_Place_*`, `Wfl_Spline_Id`, ...), `Wfl_Wcml_Article_Id` | InstantiateTemplate, page calls, CreateObjectOperations (placements), InCopy article workspaces. |
| `Wfl_New_Password` | ChangePassword (changes the password and changes it back). |
| `Wfl_Run_UpdateObjectLabels` | UpdateObjectLabels (not implemented on Studio Server 10.70). |
| `Wh_Target_Url`, `Cwh_Target_Url` | Where test webhook registrations point (example.com by default; use a webhook.site URL to see deliveries). |

# Request conventions
Studio Server's JSON-RPC interface maps JSON onto the WSDL classes. The collection follows these rules everywhere; they are also what the linter in `tools/` checks.

- `params` holds one request object: `"params": [{ ... }]` (`{ "req": { ... } }` works too).
- **Every nested object needs its `__classname__`** (`AdmPublication`, `AdmUser`, `Object`, `MetaData`, `Target`, `PlnAdvert`, ...). Without it the server receives a plain array instead of a typed object. The top-level request class name is set by the server, so it only needs to be present for readability.
- **Administration IDs are integers** and are sent unquoted (`"PublicationId": {{Publication_Id}}`). **Workflow and Planning IDs are strings** (`"ID": "{{Object_Id}}"`). Genuinely numeric fields (`Rating`, `Order`, `FirstEntry`, `PageOrder`, placement coordinates, object label `Id`) are numbers. Webhooks registration IDs are integers; Connect Webhooks registration IDs are UUID strings.
- Leave optional fields out instead of sending `""` or `null`, and only use valid enum values (`RequestModes`, `Rendition`, `Phase`, `Type`, ...).
- Files are uploaded to the Transfer Server first (`PUT transferindex.php?ticket=...&fileguid=<guid>`) and referenced in `Files[].FileUrl` by that `fileguid`.
- Planning refers to brands, channels, issues, sections, statuses and templates by **name**.

# Server behaviour found while testing (Studio Server 10.70)
Things the SDK does not tell you; each is also noted in the request description.

- Some lists come back as a JSON **object keyed by ID** instead of an array, e.g. `Routings` in CreateRoutings/GetRoutings and `ProfileFeatures` in GetAccessProfiles. The test scripts accept both.
- DeleteWorkflowUserGroupAuthorizations and DeleteRoutings take **either IDs or filters** (brand/section/user group), never both.
- GetDialog2 needs the object ID as `PropertyValues` (`[{ "Value": "<id>" }]`), not `Values`.
- ChangeOnlineStatus only works on objects the user has locked; otherwise it fails with "Database error (S1004)".
- MultiSetObjectProperties needs objects of the same type in the same brand. `Related` relations between an article and a task (or a dossier and a task) are rejected; `Contained` works.
- UpdateObjectLabels is not implemented ("The WflUpdateObjectLabels Service isn't implemented yet").
- Planning: adverts can only be created on a layout, with both `Page` and `Placement`. Layouts are created from a layout template (by name, in the same brand). CreateAdverts **creates the advert object even when it returns an error** (no layout, missing Page/Placement, unknown `LayoutName`). The Planning responses only echo Id, names and version.
- A brand that still holds objects cannot be deleted. The Setup/Teardown folders therefore purge any objects left in their test brand before deleting it.
- A new LogOn by the same user with the same `ClientAppName` replaces that user's earlier ticket, and a LogOff can invalidate the user's other sessions. The Planning test logs on with its own `ClientAppName` for that reason.
- Connect Webhooks UpdateWebhookRegistration needs the `SystemId` returned by Create.

# Running the tests
Every top-level folder except Digital Articles and Print Articles is a self-cleaning test:

| Folder | What the run does |
|---|---|
| Administration | Creates, reads, modifies, copies and deletes a brand, channel, issues, edition, section, statuses, user, group, memberships, access profile, workflow and brand-admin authorizations and a routing. |
| System Administration | LogOn and GetSubApplications. |
| Workflow | Setup creates a test brand and gives `User_Name` full access to it. Then, on a dossier, a plain-text article, a copy and a task: create, get, query, lock/unlock, save a new version, list/get/restore versions, set properties, dialogs, SendTo/SendToNext, copy, offline status, relations (incl. async), targets, labels, messages, trash/restore/delete. Teardown removes everything. |
| Planning | Setup creates a test brand; copies a layout template into it (`Pln_Template_Source_Id`), creates a layout from it, creates/modifies/deletes an advert on it, modifies and deletes the layout; Teardown removes everything. |
| Webhooks / Connect Webhooks | Trigger options, then create, list, get, update and delete a registration. Need the respective plug-in. |

**In Postman:** right-click a folder → *Run folder*.

**With Newman** (from `tools/`):
```bash
cd tools
npm install
cp "../Studio Server Environment.postman_environment.json" studio.postman_environment.json
# fill in studio.postman_environment.json (it is git-ignored), then:
npm test                 # all test folders, one Newman run each, with a summary table
npm run test:admin       # or: test:workflow, test:planning, test:webhooks, test:connect-webhooks
```
Reports are written to `tools/build/reports/<folder>.json`.

How the tests stay safe: each Create call stores the new ID in a collection variable, and later calls use only those IDs. A folder-level pre-request script **skips** any request whose test variables are not set (for example because the Create call failed), so a Delete call never runs with empty filters. A folder-level test script checks every JSON-RPC response for HTTP 200, no `error`, and the expected response class (`Adm…Response`, `Wfl…Response`, ...). Request test scripts check the returned data.

Last full run (Studio Server 10.70, Studio cloud): Administration 226, System Administration 8, Workflow 324, Planning 126, Webhooks 35, Connect Webhooks 36 assertions, all passing (optional samples skipped).

# Tools
`tools/` contains:

| Script | Purpose |
|---|---|
| `lint-collection.mjs` | Checks every JSON-RPC request of a collection against the TypeScript SDK: valid JSON, entry point, method name, required and unknown fields, integer/string/boolean/enum types, nested `__classname__`, and SDK coverage. `npm run lint`. |
| `build-collection.mjs` | Regenerates the collection from `folders/*.mjs` (one module per top-level folder). `npm run build`. |
| `run-tests.mjs` | Runs the test folders with Newman and prints a summary. |

The linter and generator need the SDK: copy `sdk/typescript/{adm,wfl,pln,sys}` from the Studio Server download to `tools/sdk/`, and `server/plugins/Webhooks/sdk/typescript/reg` to `tools/sdk/whreg` (or point `STUDIO_SDK_DIR` at a folder with that layout). The SDK is not part of this repository.

To change a request, edit the module in `tools/folders/`, run `npm run build` and `npm run lint`, and commit the regenerated collection. Changes made in the Postman app are overwritten by the next build, so bring them over into the module.

***Flows***

Flows are for the creation of a complete set of calls and responses to the API endpoint. Seeing is believing so here is a short video showing the basic creation and usage of a Flow using the Collection and the Environment:

https://user-images.githubusercontent.com/43406765/217066487-bce9221c-52a5-4481-911a-3167779e4e27.mp4

Video - Using the Postman Collection to create a digital article:
https://github.com/WoodWing/ww-studio-postman-collection/assets/43406765/37b8c46d-8ade-4b68-a0be-dc9fb1664a15

# A list of calls contained within the collection

### Workflow (119 requests)
- **00 Setup: test brand (Administration interface)**: LogOn - Administration, GetUsers (find workflow user), GetAccessProfiles (feature names), CreatePublications, CreatePubChannels, CreateIssues, CreateEditions, CreateSections, CreateStatuses, ModifyStatuses (link Draft to Ready), CreateAccessProfiles (all features), CreateUserGroups, AddUsersToGroup (workflow user), CreateWorkflowUserGroupAuthorizations
- **01 Session and server**: GetServers, LogOn, CheckTicket, GetServerInfo
- **02 User profile and settings**: GetUserProfile, GetUsers, GetUserGroups, GetTerms, SaveUserSettings, GetUserSettings, DeleteUserSettings, GetMessageQueueInfo, GetMessageList
- **03 Brand configuration**: GetPublications, GetAuthorizations, GetCustomProperties, GetNamedQueries, GetStates
- **04 Objects**: CreateObjects Dossier, Upload file to Transfer Server, CreateObjects Article, CreateObjects Task with Targets, GetObjects, QueryObjects, NamedQuery, LockObjects, UnlockObjects, GetObjects (lock for editing), Upload file to Transfer Server (new version), SaveObjects, ListVersions, GetVersion, RestoreVersion, SetObjectProperties, GetDialog2, SendToNext, SendTo, CopyObject, MultiSetObjectProperties, GetObjects (lock for offline editing), ChangeOnlineStatus (TakeOffline), ChangeOnlineStatus (TakeOnline), UnlockObjects (after offline editing)
- **05 Relations**: GetObjectRelations, CreateObjectRelations, UpdateObjectRelations, DeleteObjectRelations, CreateObjectRelationsAsync, GetCreateObjectRelationsAsyncProgress
- **06 Targets**: CreateObjectTargets, UpdateObjectTargets, DeleteObjectTargets
- **07 Object labels**: CreateObjectLabels, UpdateObjectLabels, AddObjectLabels, RemoveObjectLabels, DeleteObjectLabels
- **08 Messages**: SendMessages, SendMessages (delete message)
- **09 Samples: server configuration**: GetWebAppAuthenticationInfo, GetNativeAppAuthenticationInfo, GetTenantId, SaveAIPrompt, GetAIPrompt, CheckSpelling, GetSuggestions, CheckSpellingAndSuggest, Autocomplete, Suggestions, SetObjectExternalProperties, SetObjectProperties Custom Field, ChangePassword, ChangePassword (change back)
- **10 Samples: your own layouts, templates and InCopy articles**: InstantiateTemplate, DeleteObjects (instantiated object), GetPages, GetPagesInfo, GetRelatedPages, GetRelatedPagesInfo, CreateObjectOperations PlaceDossier, CreateObjectOperations PlaceDigitalArticle, CreateObjectOperations PlaceArticleElement, CreateObjectOperations PlaceImage, CreateObjectOperations ClearFrameContent, CreateArticleWorkspace, ListArticleWorkspaces, GetArticleFromWorkspace, SaveArticleInWorkspace, PreviewArticleAtWorkspace, PreviewArticlesAtWorkspace, DeleteArticleWorkspace
- **11 Delete and restore objects**: DeleteObjects (to Trash), RestoreObjects, DeleteObjects (permanent), QueryObjects (verify cleanup), LogOff
- **99 Teardown: test brand (Administration interface)**: LogOn (Workflow, for the object purge), QueryObjects (purge objects left in the test brand), LogOn - Administration, RemoveUsersFromGroup, DeleteUserGroups, DeleteAccessProfiles, DeletePublications, GetPublications (verify teardown), LogOff (Workflow)

### Administration (68 requests)
- LogOn - Administration
- **Publications (Brands)**: CreatePublications, GetPublications, ModifyPublications, CopyPublications
- **PubChannels**: CreatePubChannels, GetPubChannels, ModifyPubChannels
- **Issues**: CreateIssues, GetIssues, ModifyIssues, CopyIssues
- **Editions**: CreateEditions, GetEditions, ModifyEditions
- **Sections**: CreateSections, GetSections, ModifySections
- **Statuses**: CreateStatuses, GetStatuses, ModifyStatuses
- **Users**: CreateUsers, GetUsers, ModifyUsers
- **User Groups**: CreateUserGroups, GetUserGroups, ModifyUserGroups, AddUsersToGroup, GetUsers (members of group), RemoveUsersFromGroup, AddGroupsToUser, GetUserGroups (groups of user), RemoveGroupsFromUser
- **Access Profiles**: CreateAccessProfiles, GetAccessProfiles, ModifyAccessProfiles
- **Workflow User Group Authorizations**: CreateWorkflowUserGroupAuthorizations, GetWorkflowUserGroupAuthorizations, ModifyWorkflowUserGroupAuthorizations
- **Publication Admin Authorizations**: CreatePublicationAdminAuthorizations, GetPublicationAdminAuthorizations
- **Routings**: CreateRoutings, GetRoutings, ModifyRoutings
- **Autocomplete Terms (deprecated)**: CreateAutocompleteTermEntities, GetAutocompleteTermEntities, ModifyAutocompleteTermEntities, CreateAutocompleteTerms, GetAutocompleteTerms, ModifyAutocompleteTerms, DeleteAutocompleteTerms, DeleteAutocompleteTermEntities
- **Teardown (Delete calls)**: DeleteRoutings, DeletePublicationAdminAuthorizations, DeleteWorkflowUserGroupAuthorizations, DeleteAccessProfiles, DeleteUserGroups, DeleteUsers, DeleteStatuses, DeleteSections, DeleteEditions, CleanAndTrashIssues, CleanAndDeleteIssues, DeleteIssues, DeletePubChannels, DeletePublications, GetPublications (verify teardown)
- LogOff - Administration

### System Administration (2 requests)
- LogOn - Administration
- GetSubApplications

### Planning (33 requests)
- **00 Setup: test brand (Administration interface)**: LogOn - Administration, GetUsers (find workflow user), GetAccessProfiles (feature names), CreatePublications, CreatePubChannels, CreateIssues, CreateEditions, CreateSections, CreateStatuses, CreateAccessProfiles (all features), CreateUserGroups, AddUsersToGroup (workflow user), CreateWorkflowUserGroupAuthorizations
- **01 Layout template (Workflow interface)**: LogOn (Workflow), CopyObject (layout template into the test brand)
- **02 Layouts and adverts**: LogOn - Planning, CreateLayouts, CreateAdverts, ModifyAdverts, GetObjects (check the modified advert), DeleteAdverts, ModifyLayouts, DeleteLayouts, LogOff - Planning
- **99 Teardown: test brand (Administration interface)**: LogOn (Workflow, for the object purge), QueryObjects (purge objects left in the test brand), LogOn - Administration, RemoveUsersFromGroup, DeleteUserGroups, DeleteAccessProfiles, DeletePublications, GetPublications (verify teardown), LogOff (Workflow)

### Connect Webhooks (9 requests)
- LogOn
- GetTriggerOptions
- CreateWebhookRegistration
- ListWebhookRegistrations
- GetWebhookRegistration
- UpdateWebhookRegistration
- DeleteWebhookRegistration
- ListWebhookRegistrations (verify delete)
- LogOff

### Webhooks (9 requests)
- LogOn
- GetTriggerOptions
- CreateWebhookRegistration
- ListWebhookRegistrations
- GetWebhookRegistration
- UpdateWebhookRegistration
- DeleteWebhookRegistration
- ListWebhookRegistrations (verify delete)
- LogOff

### Digital Articles (5 requests)
- **Supporting Requests**: Upload Transfer Server Request, Download Transfer Server Request, Delete Transfer Server Request
- QueryObjects Digital Article Templates
- CreateObjects Digital Article

### Print Articles (4 requests)
- **Supporting Requests**: Upload Transfer Server Request, Download Transfer Server Request, Delete Transfer Server Request
- CreateObjects Print Article

## ToDo
1. Written runbooks: a markdown doc per common task (e.g. "Create a Digital Article") listing the exact request sequence to run and what each step sets/consumes.
2. Connect Webhooks has no public SDK, so its request bodies follow the plug-in's responses rather than a checked schema.

## Release Notes
 - v0.1 - Initial release of the collection
 - v0.2 - Added variables to the environment for Publication ID, Status ID and Object ID, Add variables to all of the current Workflow calls
 - v0.3 - Added Environment variables (Admin_User_Name, Admin_User_Password, Admin_Current_Ticket) to the Environment. Added 'CreateIssues' to the 'Administration' portion of the collection and did some work to clean up the other existing 'Administration' Requests.
 - v0.4 - Added 'SetObjectProperties' to the collection
 - v0.5 - Add some calls for a specific use case... creating a Digital Article. See the directory called 'Digital Articles'.
 - v0.6 - Added new calls: CreateObjects, SetObjectProperties for Custom Metadata, Admin API - GetUsers, GetUserGroups. Added Environment file to repository. Added variable to Environment for the Studio Directory value called 'Studio_Server_Directory'.
 - v0.7 - Fixed: The GetPublications call was using the wrong index for calling the service.
 - v0.8 - Added: ModifyUsersRequest has been added to the Administration calls.
 - v0.9 - Added: Create Print article section within the collection.
 - v0.10 - Added: UnlockObjects call to the collection, added video showing how to use the 'Create Digital Article' portion of the collection.
 - v0.11 - Added: Workflow > CreateObjectOperations folder with calls for PlaceDossier, PlaceArticleElement, PlaceImage and ClearFrameContent
 - v0.12 - Added: New sample call that creates a Task with Targets (CreateObjects Task with Targets), Added new folder called 'Objects and Targets' and added a call to that folder called 'CreateObjectTargets'
 - v0.13 - Added: Connect Webhooks. These calls are here to show how to create Webhooks using the new Connect Webhooks feature. Note that this feature will not be available until May 2025
 - v0.14 - Added: CopyObjects call. Also SaveObjects has been available for quite some time but not noted in the available calls below.
 - v0.15 - Added: Automatic ticket capture on all 'LogOn' requests (Workflow, Connect Webhooks, Webhooks, Planning, Administration). Test scripts now set Current_Ticket / Admin_Current_Ticket in the environment automatically, so there's no need to copy the ticket by hand after logging in.
 - v0.16 - Fixed: Removed hardcoded local file path from 'Upload Transfer Server Request' (Digital Articles and Print Articles) that broke on import for other users. Added a note in the request description prompting users to select their own file before sending.
 - v0.17 - Docs: Added folder descriptions to 'Connect Webhooks' and 'Webhooks' clarifying they are two distinct plugins, not duplicates — Connect Webhooks is the intended replacement (richer data, new delivery architecture) and Webhooks is legacy.
 - v0.18 - Fixed: Corrected invalid JSON in 'Connect Webhooks > GetWebhookRegistration' (params was wrapped in array brackets instead of an object), which would have failed to send as-is.
 - v0.19 - Added: 'DeleteLayouts', 'ModifyLayouts', and 'LogOff - Planning' to the Planning folder. Introduced a dedicated 'Planning_Ticket' environment variable, automatically captured by 'LogOn - Planning' and used by all Planning calls, separate from the main Workflow 'Current_Ticket'.
 - v0.20 - Added: 'GetPages' and 'GetPagesInfo' to the Workflow folder (previously 'GetPages' incorrectly called the GetPagesInfo method; both now have accurate descriptions).
 - v0.21 - Changed: 'Connect Webhooks' and 'Webhooks' folders now log on as admin (Admin_User_Name/Admin_User_Password) and share 'Admin_Current_Ticket' with the Administration folder, rather than using regular user credentials and Current_Ticket.
 - v0.22 - Fixed: Corrected the request body structure for 'CreateLayouts' and 'GetStates' to match the current API shape. Enhanced the 'QueryObjects' example with pagination, an additional Publication filter, and extra RequestProps.
 - v0.23 - Docs: Added descriptions to the 6 remaining undocumented requests (CreateObjects Digital Article, QueryObjects Digital Article Templates, Download Transfer Server Request under Digital Articles; CreateObjects Print Article, Delete Transfer Server Request, Download Transfer Server Request under Print Articles). Every request in the collection now has documentation.
 - v1.0 - Complete rework, checked against the Studio Server 10.70 TypeScript SDK and tested against a live server:
   - **Coverage:** every service of the Workflow (78), Administration (65), System Administration (1), Planning (8) and Webhooks/Connect Webhooks (6 each) interfaces, 249 requests in total. Added among others SaveUserSettings/DeleteUserSettings, GetTerms, GetDialog2, SendTo/SendToNext, SendMessages, LockObjects/RestoreObjects, MultiSetObjectProperties, NamedQuery, Get/Update/DeleteObjectRelations, Update/DeleteObjectTargets, versions, article workspaces, spelling, autocomplete/suggestions, pages, Update/RemoveObjectLabels, all Admin CRUD calls, the Admin autocomplete services, Planning adverts and SysGetSubApplications.
   - **Fixed:** invalid JSON bodies (Admin PubChannels, Sections, AccessProfiles; Workflow SaveObjects, CreateObjectRelations(Async); Planning adverts), requests calling the wrong method (CopyIssues, CleanAndTrashIssues, AddUsersToGroup, GetAuthorizations, DeleteUserSettings, CreateObjectRelationsAsync, GetCreateObjectRelationsAsyncProgress), wrong URLs (doubled `StudioServer/` in Admin URLs, GetSubApplications on the wrong entry point, Admin LogOff on the Workflow entry point, Download Transfer Server Request sent as DELETE), missing nested `__classname__` values, wrong field names, IDs sent as strings or `""` where the SDK expects integers, invalid `RequestModes` values, and the environment file, which contained a copy of the collection instead of an environment.
   - **Changed:** hardcoded IDs from one server replaced by variables; ID variables renamed to `_Id` (`Publication_Id`, `Status_Id`, `Object_Id`); `FileUploadUrl` removed (requests use `transferindex.php` directly). Webhooks and Connect Webhooks log on with the workflow user (`User_Name`, `Current_Ticket`): the v0.21 admin logon was not in the published collection.
   - **Added:** self-cleaning test cycles per folder (folder-level guard and response checks, per-request data checks), the `tools/` folder (SDK linter, collection generator, Newman runner), and documentation of the server behaviour found while testing.
