# Introduction
This is a Postman collection for working with WoodWing Studio. The collection itself contains, at this time, a subset of the available API calls. Those that are included in the collection are noted below. All of the Studio API documentation can be found in the SDK doc

In some cases we have added parameters to the calls so that they may be more useful as a starting point.

# Postman Explanation

When creating this collection we considered three parts of Postman's capabilities:

1. Collections
2. Environments
3. Flows (part of Postman 10)

Please note that to use this collection you will need to create your Environment and, if you wish to use Flows, you'll need to create those as well. Farther down we have included videos to help out with that process.

The relationship between the Collection and the Environments is particularly helpful. Environments allows us to create variables, attach values to the variables and then pass the variable value(s) to subsequent calls. The variables can be used calling each individual call within the collection or you can set up a Flow to use them.

In our environment, named 'WoodWing Studio', we have a variety of variables:

1. ***Studio_Server_URL*** - Add to the body parameters as {{Studio_Server_URL}}
2. ***Studio_Server_Directory*** - Server Directory value after the URL. Noted as {{Studio_Server_Directory}}
3. ***User_Name*** - Add to the body parameters as {{User_Name}}
4. ***Password*** - Add to the body parameters as {{Password}}
5. ***Current_Ticket*** - Add to the body parameters as {{Current_Ticket}}
6. ***Publication_ID*** - Add to the body parameters as {{Publication_ID}}
7. ***Status_ID*** - Add to the body parameters as {{Status_ID}}
8. ***Object_ID*** - Add to the body parameters as {{Object_ID}}
9. ***Admin_User_Name*** - Add to the body parameters as {{Admin_User_Name}}
10. ***Admin_User_Password*** - Add to the body parameters as {{Admin_User_Password}}
11. ***Admin_Current_Ticket*** - Add to the body parameters as {{Admin_Current_Ticket}}
12. ***FileUploadURL*** - Just a reference to '/transferindex.php' file
13. ***Uuid_For_PUT*** - Variable to hold the UUID generated in the 'PUT' call 'Upload Transfer Server Request' to upload the file. Look in the 'Pre-request Script' area for the actual script.

***Flows***

Flows are for the creation of a complete set of calls and responses to the API endpoint. Seeing is believing so here is a short video showing the basic creation and usage of a Flow using the Collection and the Environment:

https://user-images.githubusercontent.com/43406765/217066487-bce9221c-52a5-4481-911a-3167779e4e27.mp4


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

Located in 'Digital Articles > Supporting Requests'
1. Upload Transfer Server request (PUT)
2. Delete Transfer Server Request (PUT)
3. Download Transfer Server Request (GET)

Additional calls (Copy of already existing calls modified for the use case): 
Located in 'Digital Articles'

1. QueryObjects Digital Article Template
2. CreateObjects Digital Article


## ToDo
----
1. Script to automatically add the ticket to the calls
2. Add and vet more calls
3. Share some flows

## A list of Calls contained within the collection

## Workflow (incomplete)
 1. LogOn
 2. QueryObjects
 3. GetObjects
 4. CreateObjects
 5. SetObjectProperties
 6. SetObjectProperties Custom Metadata
 7. GetPublications
 8. GetStates
 11. DeleteObjects
 12. GetUsers
 13. GetServerInfo
 14. GetUserGroups
 18. GetUserProfile
 19. GetUserSettings
 20. GetNamedQueries
 21. CheckTicket
 23. LogOff

## Administration (incomplete)
 1. LogOn - Administration
 3. GetIssues
 4. CreateIssues
 5. CopyPublications
 6. GetUsers
 7. GetUserGroups
 8. LogOff - Administration

## System Administration (incomplete)

## Planning (incomplete)
 1. LogOn - Planning
 2. Create Layouts
 
## Webhooks
 1. LogOn
 2. GetTriggerOptions
 3. ListWebhookRegistrations
 4. CreateWebhookRegistration
 5. GetWebhookRegistration  (added August 9, 2023)
 6. UpdateWebhookRegistration (added August 9, 2023)
 7. DeleteWebhookRegistration
 8. LogOff

## Digital Articles
 1. Supporting Requests
    a. Upload Transfer Server Request
    b. Delete Transfer Server Request
    c. Download Transfer Server Request
 2. QueryObjects Digital Article Templates
 3. CreateObjects Digital Article

## Misc

## ConnectAutomate
