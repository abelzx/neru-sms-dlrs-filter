# Neru SMS API DLRs callback filter

This sample project help to filter the DLRs, to allow only statuses:
"delivered", "expired", "failed", "rejected", and "unknown"
DLRs to hit the customer webhook


## How to deploy
1. clone the project and run `npm install`
2. create neru project, follow instruction in https://vonage-neru.herokuapp.com/neru/getting-started
3. rename neru.example.yml to neru.yml and replace the variables with your neru project info.
4. deploy the app to neru


## How to use
To configure the customer dlrs webhook:
 1. login to the deployed neru app
 2. Set the dlrs customer webhook url to point to your server destination:
    ex: https://{{domain}}/{{region}}/test/drls
    (noted: any text encloded in double curly braces will be replaced by the neru proxy)
 3. Click `submit` button

Set SMS callback url:
1. set the custom SMS API callback url to:
   https://{{your-neru-app-domain}}/dlr/?{{param1}}%26{{param2}}
   ex: https://neru-123abc-dlr-dev.apse1.serverless.vonage.com/dlr/?domain=www.example.com%26region=sg

With setup above, only the allowed SMS DLSs will be forwarded to customer dlrs webhook (ex: https://www.example.com/sg/test/drls)
