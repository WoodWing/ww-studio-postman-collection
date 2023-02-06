# Introduction
This is a Postman collection for working with WoodWing Studio. The collection itself contains, at this time, a subset of the available API calls. Those that are included in the collection are noted below. All of the Assets API documentation can be found in the SDK doc

In some cases we have added parameters to the calls so that they may be more useful as a starting point.

# Postman Explanation

When creating this collection we considered three parts of Postman's capabilities:

1. Collections
2. Environments
3. Flows (part of Postman 10)

Please note that to use this collection you will need to create your Environment and, if you wish to use Flows, you'll need to create those as well. Farther down we have included videos to help out with that process.

The relationship between the Collection and the Environments is particularly helpful. Environments allows us to create variables, attach values to the variables and then pass the variable value(s) to subsequent calls. The variables can be used calling each individual call within the collection or you can set up a Flow to use them.

In our environment, named 'WoodWing Studio', we have 4 variables:

1. ***Studio_Server_URL*** - referenced in the collection as {{Studio_Server_URL}}
2. ***User_Name*** - references in the collection as {{User_Name}}
3. ***Password*** - references in the collection as {{Password}}
4. ***Current_Ticket*** - references in the collection as {{Current_Ticket}}

Flows

Flows are for the creation of a complete set of calls and responses to the API endpoint. Seeing is believing so here is a short video showing the basic creation and usage of a Flow using the Collection and the Environment:

Here is a short video showing how the Studio collection works with Postman Environments and Flows work:

https://user-images.githubusercontent.com/43406765/217066487-bce9221c-52a5-4481-911a-3167779e4e27.mp4


## Release Notes

v0.1 - Initial release of the collection

A list of Calls contained within the collection

## Workflow (incomplete)
 1. LogOn
 2. GetPublications
 3. GetStates
 4. QueryObjects
 5. GetObjects
 6. DeleteObjects
 7. LogOff
 8. GetUsersSettings
 9. GetServerInfo
 10. GetUserGroups
 11. GetUserProfile
 12. GetNamedQueries
 13. CheckTicket

## Administration (incomplete)
 1. LogOn - Administration
 2. CopyPublications

## System Administration (incomplete

## Planning (incomplete)
 3. LogOn - Planning
 4. Create Layouts
 
## Webhooks
 1. LogOn
 2. GetTriggerOptions
 3. ListWebhookRegistrations
 4. CreateWebhookRegistration
 5. DeleteWebhookRegistration
 6. LogOff
