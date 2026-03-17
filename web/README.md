# @i4mi/js-on-fhir FHIR® library with OAuth 2.0 for web applications built with JavaScript frameworks

![][~license]
![][~issues]

Wrapper for the I4MI FHIR® resources, inheritance and type definitions library [@i4mi/fhir_r4](https://www.npmjs.com/package/@i4mi/fhir_r4).

This library handles the OAuth 2.0 authorization process, providing essential functionality for the client side. It also provides other functionality to interact with a given FHIR server. It can be used in web applications that are built with JavaScript frameworks (e.g. [Angular](https://angular.io/), [Vue.js](https://vuejs.org/) and [Quasar](https://quasar.dev/)).

See below for [instructions](#2-vue) for using it with [Vue.js](https://vuejs.org/).

If you are updating from an earlier version of this library to 1.0.0 or higher, you may have to adapt some of your code. See the [list of breaking changes in chapter 7](#7-changeLog).

## Content
- [1 Usage](#1-usage)
  - [1.1 Install package](#1.1-install)
  - [1.2 Import and initialize](#1.2-import)
  - [1.3 Auth process](#1.3-auth)
  - [1.4 Methods](#1.4-methods)
  - [1.5 Examples](#1.5-examples)
- [2 Using with Vue.js](#2-vue)
  - [2.1 Making your jsOnFhir instance globally available](#2.1-globalFhir)
  - [2.2 Handle the two-step auth process](#2.2-twoStepAuth)
- [4 Demo app](#4-demoApp)
- [5 Dev](#5-dev)
- [6 Submit issues](#6-issues)
- [7 Changelog](#7-changeLog)
  - [7.1 Breaking changes in Version 1.0.0](#7-changeLog)

<a name="1-usage"></a>

## 1 Usage

<a name="1.1-install"></a>

### 1.1 Install package
Install package with:

```shell
npm i @i4mi/js-on-fhir
```

<a name="1.2-import"></a>

### 1.2 Import and initialize module
To use js-on-fhir, you have to import it on the entry page on your project.

```javascript
import { JSOnFhir } from '@i4mi/js-on-fhir';
```

<a name="1.2.1-constructor"></a>

#### 1.2.1 Constructor
Then you can declare an instance, passing the needed parameters to the constructor:

```javascript
const fhir = new JSOnFhir('serverUrl', 'clientId', 'redirectUrl');
```

where the parameters correspond to:

- _serverUrl_: The BASE URL of the FHIR server you want to communicate with (the base url does not include the trailing `/fhir/`)
- _clientId_: The ID of your FHIR application as registered with the FHIR server.
- _redirectUrl_: The URL the server can talk back to your app during the auth process. When testing locally, this may look like `http://localhost:8080` or similar. The page loaded from this exact URL must call the `handleAuthResponse()` function (see below). Also mind that the _redirectUrl_ may have to be registered server-side for security reasons.
- _options_: Optional parameter. Options you want to pass as an object literal to the constructor for configuring the jsOnFhir object.
  - _doesNotNeedAuth_: Optional parameter. Set to true when the FHIR server you're using doesn't require authentication (e.g. when connecting to the EPD playground via MobileAccessGateway). In this case, the parameters clientId and redirectUrl do not matter (but still have to be set.)
  - _disablePkce_: Optional parameter. Set to true if you want to use the OAuth 2.0 authorization code flow instead of the recommended and more secure PKCE flow or the server does not support PKCE.
  - _fhirVersion_: Optional parameter. Specify the FHIR version you want to use (and that is supported by the server). Default value is '4.0.1'.

The constructor keeps track of your jsOnFhir instances and persists them over page reloads, as long as you keep the browser session. This means that when you call the constructor with the same parameters again during a session, the earlier created instance is restored instead of creating a new one, including all the auth details.

#### 1.2.2 Authentication free FHIR servers
If you want to use js-on-fhir with a FHIR server that does not need authentication (e.g. when accessing the [EPD Playground with the Mobile Access Gateway](https://epdplayground.ch/index.php?title=Main_Page), or when you're doing the [FHIR Drills tutorial](https://fhir-drills.github.io/index.html)), you can set the optional _doesNotNeedAuth_ parameter in the constructor via the options object literal to `true`:

```javascript
const fhir = new JSOnFhir('serverUrl', '', '', { doesNotNeedAuth: true });
```

With this setting, you will be able to do read and / or write requests (depending on the server's configuration) without having to deal with the auth process. The second and third parameter of the constructor (_clientId_ and _redirectUrl_) can be empty strings, but should not be `null` or `undefined`.

<a name="1.2.3-no-pkce"></a>
#### 1.2.3 Authorization without PKCE extension
Per default jsOnFhir uses the [OAuth 2.0 Authorization Code Grant](tools.ietf.org/html/rfc6749#section-1.3.1) with the [PKCE (RFC 7636): Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636) extension. The _PKCE_ is an extension to the authorization code flow to prevent CSRF and authorization code injection attacks. However, if the FHIR server you are using does not support this extension, you can set the optional _disablePkce_ parameter in the constructor via the options object literal to `true`:

```javascript
const fhir = new JSOnFhir('serverUrl', 'clientId', 'redirectUrl', { disablePkce: true });
```

<a name="1.3-auth"></a>

### 1.3 Auth process
Before you can read or write to the FHIR server, you need to authenticate with OAuth 2.0. As mentioned in section [1.2.3](#1.2.3-no-pkce), this plugin supports the OAuth 2.0 Authorization Code Grant with the PKCE extension.
Strictly speaking this plugin can't completely handle the whole OAuth 2.0 procedure. It provides necessary client side functionality, but there are still dependencies which arise from the auth server and have to be handled by the latter.

<a name="1.3.1-authStart"></a>
#### 1.3.1 Starting the auth process
For triggering the auth process, you can call the `authenticate()` method from anywhere in your web application. When everything is configured properly, this opens a page for your user to log in with their credentials. The authorization server then validates the request to ensure that all required parameters are present and valid. If the request is valid, this page redirects to the _redirectUrl_ given before. This is known as the authorization response.

#### 1.3.2 Second step of the auth process
For handling the authorization response, you need to call the `handleAuthResponse()` method from the page that is loaded when calling the given _redirectUrl_. You don't have to differentiate if the page was called by the server's auth page or just by using your app, this is handled by the method itself.

What happens behind the scenes is that this plugin makes a token request after recieving the authorization response. The response of the token endpoint consists of the access and the refreshToken which will be saved into the sessionStorage. This method therefore returns a promise that resolves with the server's response when the authentication and token request was successful, or is rejected with the error message if either one wasn't (when the method was called during a non-auth-related page reload, the promise resolves with `null`).

Unless you want to store the _refresh token_, you usually don't have to do anything with the server response here, since the plugin handles everything auth related for you.

#### 1.3.4 Refreshing the authentication
The _access token_ received during the auth process is only valid for a given time, usually in a range of hours. After this time, or when having a new browser session, you need to re-authenticate, either by restarting the auth process or by using a _refresh token_, that is included in the server's auth response.

So if you want to use the _refresh token_ for re-authentication, you have to persist it when you get the server's auth response. Please mind that the _refresh token_ for a health record is considered sensible information and has to be saved securely.

```javascript
let refreshToken;
fhir.handleAuthResponse()
.then((res) => {
  // check if the response is not null
  if (res) {
    // we are authenticated
    // ... and can keep refreshToken
    refreshToken = res.refresh_token;
  }
})
.catch((err) => {
  // oops, something went wrong
  console.log(err);
});

// later, we can use the refresh token for re-authentication
fhir.refreshAuth(refreshToken)
.then((res) => {
  /* do something*/
})
.catch((err) => {
  /* do something */
});
```

The _refresh token_ is only valid once, so the `refreshAuth()` method also returns a promise with the server response, including a new _refresh token_. You can save this new _refresh token_ the same way as you did when calling `handleAuthResponse()`.

### 1.3.5 Custom auth process
You can also use a custom auth flow and set the auth information with `initExternalAuth(authInfo)` method. The authInfo object must at least contain an access_token, patient and expires_in, but can have all the properties described in the AuthInfo interface:
```typescript
export interface AuthResponse {
  state: string;        // if everyting ok --> none
  access_token: string; // The access token issued by the authorization server
  token_type: 'Bearer'; // Fixed value: Bearer
  expires_in: number;   // Lifetime of the access token in seconds, after which the token SHALL NOT be accepted by the resource server
  scope: string;        // Scope of access authorized. Note that this can be different from the scopes requested by the app. ("user/*.*")
  id_token?: string;    // Authenticated patient identity and user details, if requested
  patient: string;      // field name for user id defined by SMART on FHIR
  refresh_token: string;// Token that can be used to obtain a new access token,
                        // using the same or a subset of the original authorization grants
}
```

<a name="1.3.5.1-capacitor"></a>
#### 1.3.5.1 Example with Capacitor
The built-in `authenticate()` and `handleAuthResponse()` methods rely on browser `sessionStorage` and `window.location.href` redirects. On mobile devices (iOS/Android) running Capacitor or Cordova, the OS may clear the WebView's memory when the system browser opens, causing the login to fail when the user returns to the app.

For mobile apps, you should handle the OAuth 2.0 PKCE flow natively using plugins (e.g., `@capacitor/browser`, `@capacitor/app` and a secure keychain storage plugin like [capacitor-secure-storage-plugin](https://github.com/martinkasa/capacitor-secure-storage-plugin)). 

Once your native app has successfully retrieved the tokens, you can initialize your `JSOnFhir` instance using the `initExternalAuth` method. This method injects the tokens securely and automatically fetches the server's conformance statement, allowing you to use all of the library's FHIR fetching and updating methods without its web-based login flow.

```javascript
import { JSOnFhir } from '@i4mi/js-on-fhir';

// 1. Initialize the library normally
const fhir = new JSOnFhir('https://test.midata.coop', 'my-client-id', 'my.custom.scheme:/');

// 2. Perform your native OAuth login using Capacitor plugins...
// const authInfo = await myOwnLoginFlow();

// 3. Initialize the FHIR library with your native authInfo
// This injects the auth state and then fetches the server metadata
await fhir.initExternalAuth(authInfo);
);

// You can now securely query the FHIR API
fhir.search('Observation', { code: '41950-7' })
  .then(res => console.log(res));
```

<a name="1.4-methods"></a>
## 1.4 Methods
The following table describes all the methods intended for public use.

| Function            | Description                            | Params | Returns |  
| ---                 | ---                                    | ---    | ---     |
|authenticate(*params?*)     |Starts the two-step authentication process (see [1.3.1](#1.3.1-authStart)).|*params*: (optional) additional params to be added to the auth URL, as key/value object.  |nothing<br/>(but redirects to the server's auth page) |
|handleAuthResponse()|Handles the callback by the auth server. Has to be called when loading the page by the *redirectUrl* (see [1.2.1](#1.2.1-constructor)). The returned auth token is handled by the plugin and does not require further action.|none|A promise that resolves to <br/>a) the server's response when in the auth process and the request was successful (HTTP status 200 / 201)<br/>b) null when not in the auth process or <br/>c) rejects with an error message when in the auth process and an error occurred.|
refreshAuth(*rToken*)  |Refreshes the authentication with a refresh token. The returned auth token is handled by the plugin and does not require further action.| *rToken*: a refresh token that was saved from an earlier server auth response.|A promise that <br/>resolves to the server's response (including a new refresh token) or <br/>rejects with an error message.|
|initExternalAuth(*authInfo*)|Sets externaly aquired auth information (see [example](#1.3.5.1-capacitor))|*authInfo*: A partial AuthResponse object that contains at least *access_token*, *patient* and *expires_in*|A void promise.|
isLoggedIn()          |Checks if an auth token is set and not expired.|none|*true* if a token is set and not yet expired, *false* if no token is set, or it is expired.|
logout()              |Logs out the user by deleting all the authentication information.|none|nothing|
create(*resource*)    |Creates a new resource on the FHIR server.|*resource*: the resource to create.|A promise that: <br/>resolves with the created resource if successful (HTTP status 200 / 201), or <br/>rejects with an error message.|
update(*resource*)    |Updates an existing resource on the FHIR server.|*resource*: the resource to update. Note that the *resource.id* must be set and correct.|A promise that:<br/>resolves with the updated resource if successful (HTTP status 200 / 201), or <br/>rejects with an error message.|
search(*resourceType*, *params?*)|Searches for resources on the FHIR server.|*resourceType*: the resource type to look up.<br/>*params*: (optional) the FHIR search parameters (see [hl7.org](https://www.hl7.org/fhir/search.html) for details).|A promise that:<br/>a) resolves to the server's response (a FHIR bundle with the search results) if sucessful or<br/>b) rejects with an error message.|
getResource(*resourceType*, *id*)|Fetches a resource with known id from the FHIR server.|*resourceType*: the resource type to look up.<br/>*id*: The unique FHIR id of the resource.|A promise that:<br/>a) resolves to the server's response (as a Resource object, not a Bundle) if sucessful or<br/>b) rejects with an error message.|
performOperation(*operation*, *payload?*, *httpMethod?*, *params*?, *resourceType?*, *resourceId?*)| Performs a [FHIR Operation](https://www.hl7.org/fhir/operations.html), as for example processing a FHIR Message, on the FHIR server.|*operation*: The operation type to perform, without leading $ sign (use `process-message`, not `$process-message`).<br />*payload* (optional): Input payload for the operation<br />*httpMethod* (optional): Specify the HTTP method for the operation (`GET`, `POST`, `PUT` or `DELETE`, default is `POST`.)<br />*params* (optional): Parameter for the operation, either as a key/value pair object (like `{id: 'a1b2c3'}`) or as a string of url parameters (like `?id=a1b2c3`)<br /> *resourceType* (optional): String indicating the resource type to perform the operation on (e.g. `Observation`).<br />*resourceId* (optional): Use resource ID (e.g. `s`) to specify the resource instance to perform the operation on. Can only be used in combination with a *resourceType*. | A promise that:<br/>a) resolves to the server's response (a FHIR bundle with the search results) if sucessful or<br/>b) rejects with an error message. |
getUserId()          |Gets the resource ID of the current user, if logged in. With this user, the corresponding Patient resource (or Practitioner resource, when logged in as Health Professional or Researcher) can be fetched.|none|The ID of the Patient or Practitioner resource of the currently logged in user. `undefined` if no user is logged in.|
setLanguage(*lang*)   |Sets the language used for the server's auth window (if supported server-side).|*lang*: The abbreviation of the wanted language (e.g. `'en'`, `'de'`, `'fr'` or `'it'`).|nothing|
setConformanceUrl(*url*)|Manually sets the conformance URL. Only necessary if it deviates from the standard `myserver.net/fhir/metadata` scheme, as this is generated as a default.|*url*: the server's conformance URL.|nothing|
setScope(*scope*)|Manually sets the scope. Only necessary if scope differs from the default `user/*.*`.|*scope*: the desired scope. |nothing|
changeFhirVersion(*version*)|Select the FHIR version to use in the requests.|*version*: The FHIR version to use (caution: support of versions can be restricted on the server used). Supported versions are: STU3 (`3.0.2`), R4 (`4.0.1`), R4B (`4.3.0`) and R5 (`5.0.0`)|nothing|

<a name="1.5-examples"></a>
## 1.5 Examples of Interactions with a FHIR server

### 1.5.1 Search
Searching for resources returns a bundle with all resources matching the search criteria (in the example: all resources of type "Observation" since the Titanic sank on April 15th in 1912.)
```javascript
fhir.search('Observation', { date: 'ge1912-04-15' })
.then((response) => {
  // response is now the server response with the resource in the body
  // only if status is 200 or 201

  // print the id of the first resource in the response bundle
  console.log(response.entry[0].resource.id);
}).catch((error) => {
  // here you can / have to handle everything that can go wrong
  // (everything other than status 200 / 201)
});

```

### 1.5.2 Create
Creates a FHIR resource.
```javascript
let myResource = {
  "resourceType": "Observation",
  /* ... */
}
fhir.create(myResource)
.then((response) => {
  // response is now the server response with the resource in the body
  // only if status is 200 or 201
  }).catch((error) => {
  // here you can / have to handle everything that can go wrong
  // (everything other than status 200 / 201)
});

```

### 1.5.3 Update
Updates a FHIR resource.
*IMPORTANT:* The resource needs to have an id and meta.versionId for updating.
```javascript
fhir.update(myResource)
.then((response) => {
  // response is now the server response with the resource in the body
  // only if status is 200 or 201
  }).catch((error) => {
  // here you can / have to handle everything that can go wrong
  // (everything other than status 200 / 201)
});
```
<a name="2-vue"></a>
## 2 Using with Vue.js
If you want to use jsOnFhir in a Vue.js project, it is recommended to declare the instance in your `main.js` and then make it available globally.

<a name="2.1-globalFhir"></a>
### 2.1 Make your jsOnFhir instance globally available
This is achieved by adding a getter function for the jsOnFhir instance to the Vue prototype. Your `main.js` then should look like this:

<a name="2.1.1-main.js-vue2"></a>
#### 2.1.1 Setting up main.js (Vue 2)
```javascript
import Vue from 'vue'
import App from './App.vue'


/* snip: insert this to your main.js */

// import JSonFhir after installing it from npm
import { JSOnFhir } from '@i4mi/js-on-fhir'
// declare a constant with your correct parameters
const fhir = new JSOnFhir(
  'serverUrl',
  'clientId',
  'redirectUrl',
  {
    disablePkce: false,
    doesNotNeedAuth: false
  }
);
// attach a getter function to the Vue prototype to make it globally available
Object.defineProperties(Vue.prototype, {
  $fhir: {
    get: function() {
      return fhir;
    }
  }
});
/* snap - that's it */

Vue.config.productionTip = false
new Vue({
  render: function (h) { return h(App) },
}).$mount('#app')
```
<a name="2.1.2-main.js-vue3"></a>
#### 2.1.2 Setting up main.js (Vue 3)
In Vue 3, setting global properties works a bit different:
```javascript
import { createApp } from 'vue';
import App from './App.vue';

const app = createApp(App);

/* snip: insert this to your main.js */

// import JSonFhir after installing it from npm
import { JSOnFhir } from '@i4mi/js-on-fhir';
// set global property
app.config.globalProperties.$fhir = new JSOnFhir(
  'serverUrl',
  'clientId',
  'redirectUrl',
  {
    disablePkce: false,
    doesNotNeedAuth: false
  }
);
/* snap - that's it */

app.mount('#app');

```

#### 2.1.3 Accessing global jsOnFhir in the components (Vue 2 and 3)
After setting up the globally available jsOnFhir instance (see [2.1.1](#2.1.1-main.js-vue2) or [2.1.2](#2.1.2-main.js-vue3)), it can be accessed in every component like this:
```javascript
let loggedIn = this.$fhir.isLoggedIn();
```
This works in every of your components, without the need to import the package or initialize a new jsOnFhir instance.

<a name="2.2-twoStepAuth"></a>
### 2.2 Handle the two-step auth process
For handling the two-step auth process, you have to include the `handleAuthResponse()` method into the mounted() section on the root view of your project (or whatever page you pointed the *redirectUrl* to). In a default Vue.js project, this would be `App.vue`.
```javascript
/* ... */
mounted(){ // mounted() is automatically executed every time your Vue component is mounted
  this.$fhir.handleAuthResponse()
  .then(response => {
    if(response){ // check if response is not null - we have to check for this,
      // or we will overwrite the auth token every time when reloading the component

      // when we get to here, we are authenticated
      console.log("logged in?", this.$fhir.isLoggedIn()); // see?

      let refreshToken = response.refresh_token;
      // keep this refreshToken in a safe place
      // e.g. on a post-it attached to your screen ;-)
    }
  })
  .catch(err => {
    // if something went wrong, we end up here
    console.log(err);
  });
}
/* ... */
```
You then can call the `this.$fhir.authenticate()` method from anywhere in your project, which takes the user to the server's auth page and further to the defined *redirectUrl* (which is your `App.vue`), where the auth response is handled.

<a name="4-demoApp"></a>
## 4 Demo app
A demonstration of the most important functions and the implementation can be seen in a simple demo app available on [i4mi/midata-quasar-starter-app](https://github.com/i4mi/midata-quasar-starter-app). The demo app is built using the Quasar Framework, which uses Vue.js as an underlying technology and can be used as a starter template for your own project.

<a name="5-dev"></a>
## 5 Dev
If you want to contribute to the plugin, you can clone the repository from GitHub:  
`git clone https://github.com/i4mi/fhir-wrappers.ts.git`

Then check out the `development` branch (or directly clone it: `git clone -b develop https://github.com/i4mi/fhir-wrappers.ts.git`).

Then create your own branch with a title, according the feature you want to implement!

install (dev) dependencies
`npm install --save`

build  
`npm run build`

publish: login with i4mi account  
`npm publish --access public`

<a name="6-issues"></a>
## 6 Submit issues
Go to the global repo issue site on [GitHub](https://github.com/i4mi/fhir-wrappers.ts/issues).

Create a new issue with the label ![][~web].

<a name="7-changeLog"></a>
## 7 Changelog

### 7.1 Breaking changes in Version 1.0.0
- Different methods have now typed return values. In TypeScript projects, this may lead to errors (that are usually easy to fix, though).
- The *search()* method now checks the resourceType parameter for validity (if supported by the server, according to the conformance statement). This means that the common practice for passing a whole search string to the method as resourceType does no longer work. Use the params parameter for search params instead. 
  - For fetching a resource with a known id, use the new *getResource()* method instead. The benefit of this is, that the *search()* method return value can be typed as a Bundle, and the *getResource()* return value can be typed as a Resource.
- The getPatient() method is deprecated and has been renamed to getUserId(), which is more descriptive (since it returns only the ID and not the whole resource, and can also return the Practitioner ID when logged in as Health Professional or Researcher).
- The (undocumented) generateRandomState(length) method is no longer available. If you used it to create a prefilled registering link, you can instead use the authenticate() method and pass the prefilled fields as key/value pair.
- Version 2.0.0 of `@i4mi/fhir_r4` is used, which has incompabilities to previous versions. You may have to update your project to Version 2.0.0 of `@i4mi/fhir_r4` when using TypeScript.
- PKCE Code Challenge is used per default for the auth, which may cause problems if your server does not support PKCE. You can disable this behaviour by setting `disablePKCE` in the option objects of the constructor to `true` (see [chapter 1.2.3](#1.2-import))
- The way the data is stored in the session storage has changed. No action is needed in your application, but the user will have to log in again when you update your existing application to version 1.0.0.

| Version | Date       | Changes      |
| ---     | ---        | ---          |
| 1.1.1   | 2026-03-17 | - Fix bug: Load capability statement for servers without authentication.|
| 1.1.0   | 2026-03-12 | - Added initExternalAuth method to allow auth flow for mobile devices.|
| 1.0.3   | 2026-02-06 | - Update dependencies. |
| 1.0.2   | 2025-05-27 | - Update readme. |
| 1.0.1   | 2025-05-26 | - Update dependencies. |
| 1.0.0   | 2022-12-16 | - Add ability to use PKCE extension.<br /> - Adjusted usage of session storage and added an IIFE for not exposing auth information to the parent application. This is for preventing saving things twice, and also for obscuring auth data (however, this is NOT an encription!) <br /> - Adjusted constructor. <br /> - Added ability to have multiple jsOnFhir instances run in the same project (e.g. for different servers). <br /> - Remove deprecated processMessage() method.<br /> - Add changeFhirVersion() method.<br /> - Add getUserId() method.<br /> - Deprecate getPatient() method. <br /> - Fix errors in README and add descriptions regarding PKCE and constructor.<br /> - Link to the new demo app. |
| 0.3.0   | 2022-11-07 | - Use @i4mi/fhir_r4 version 2.0.0.|
| 0.2.4   | 2022-06-28 | - Use @i4mi/fhir_r4 version 1.1.1, because using 1.1.0 could cause bugs when using Vue.js with vite.|
| 0.2.3   | 2022-06-27 | - Fix bug for performOperation() not using the auth token.|
| 0.2.2   | 2022-06-27 | (skipped for technical reasons)|
| 0.2.1   | 2021-11-10 | - Add performOperation()<br />- Adjusted README for usage with Vue 3.|
| 0.2.0   | 2021-11-03 | - Add processMessage()<br />- Fix errors in README |
| 0.1.0   | 2021-10-18 | - Add ability to use FHIR servers without authentication. <br />- Update some dependencies.<br />- Add changelog to README.<br />- Fix vulnerabilities in packages |
| 0.0.21  | 2021-09-06 | Updated some dependencies.|
| 0.0.20  | 2020-11-20 | Add *getAccessToken()* method.|
| 0.0.19  | 2020-11-03 | Logout when server responds with 401 or invalid / expired token.|
| 0.0.18  | 2020-07-06 | Update README and make params in *search()* optional.|
| 0.0.17  | 2020-07-02 | Enable additional (optional) parameters on authenticate().|
| 0.0.16  | 2020-06-12 | Make *fetchConformanceStatement()* public.|
| 0.0.15  | 2020-06-11 | Make *generateRandomState()* function public and let it return the state.|
| 0.0.14  | 2020-06-09 | Bugfix.|
| 0.0.13  | 2020-06-03 | Fix a bug where Webapps with '#' in URL could not authenticate.|
| 0.0.12  | 2020-06-03 | - Update dependencies<br />- Add *getPatient()* method.|
| 0.0.11  | 2019-12-02 | Update README with License and FHIR trademark remarks.|
| 0.0.9   | 2019-11-22 | Fix broxen *setLanguage()* method.|
| 0.0.6   | 2019-09-20 | Update dependencies and bugfix.|
| 0.0.5   | 2019-09-10 | Add demo app to and fix README.|
| 0.0.4   | 2019-09-09 | Cleanup and adjust README.|
| 0.0.1   | 2019-08-29 | Initial version.|

-----
FHIR® is the registered trademark of HL7 and is used with the permission of HL7. Use of the FHIR trademark does not constitute endorsement of this product by HL7.

[~web]: https://img.shields.io/static/v1?label=-->&message=WEB&color=green

[~issues]: https://img.shields.io/github/issues-raw/i4mi/fhir-wrappers.ts/web

[~license]: https://img.shields.io/static/v1?label=license&message=Apache-2.0&color=blue
