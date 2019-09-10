# IN DEVELOPMENT! - use at own risk -

Wrapper for the [I4MI fhir-resource-r4 library](https://www.npmjs.com/package/@i4mi/fhir_r4).  
This library handles the oAuth 2.0 process for any JavaScript web-app on npm. See below for detailed instructions for [using it with Vue.js](#2-vue).

For projects using the IONIC framework, you may consider the [@i4mi/ionic-on-fhir wrapper](https://www.npmjs.com/package/@i4mi/ionic-on-fhir).

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
  - [2.2 Demo app](#3-demo-app)
- [3 Dev](#3-dev)
- [4 Submit issues](#4-issues)

<a name="1-usage"></a>
## 1 Usage

<a name="1.1-install"></a>
### 1.1 Install package
Install package with:
`npm i @i4mi/js-on-fhir`.

<a name="1.2-import"></a>
### 1.2 Import and initialize module
To use js-on-fhir, you have to import it on the entry page on your project.
```javascript
import { JSOnFhir } from '@i4mi/js-on-fhir';
```

<a name="1.2.1-constructor"></a>
#### 1.2.1 The constructor
Then you can declare a instance, passing the needed parameters to the constructor:
```javascript
const fhir = new JSOnFhir('server_url', 'client_id', 'redirect_url');
```
where the parameters correspond to:
- *server_url*: the URL of the FHIR-server you want to communicate with
- *client_id*: the name of your application as registered with the server
- *redirect_url*: the URL the server can talk back to your app during the auth process. When testing locally, this may look like `http://localhost:8080` or similar. The page loaded from this exact URL must call the `handleAuthResponse()` function (see below). Also mind that the *redirect_url* may have to be registered server-side for security reasons.

The constructor keeps track of your JSOnFhir instances and persists them over page reloads, as long as you keep the browser session. This means that when you call the constructor with the same parameters again during a session, the earlier created instance is restored instead of creating a new one, including all the auth details.

<a name="1.3-auth"></a>
### 1.3 Auth process
Before you can read or write to the FHIR server, you need to authenticate with OAuth2. This is a two-step process that can't be handled completely by the plugin alone.

<a name="1.3.1-authStart"></a>
#### 1.3.1 Starting the auth process
For triggering the auth process, you can call the `authenticate()` method from anywhere in your web application. When everything is configured properly, this opens a page for your user to log in with his credentials. When the users credentials are correct, this page redirects to the *redirect_url* given before, passing along some arguments used for the second step.

#### 1.3.2 Second step of the auth process
You don't need to take care of these arguments. All you need to do is to call the `handleAuthResponse()` method from the page that is loaded when calling the given *redirect_url*. You don't have to have to differentiate if the page was called by the servers auth page or just by using your app, this is handled by the method.

The method returns a promise that resolves with the servers response when the auth was successful, or is rejected with the error message if it wasn't (when the method was called during a non-auth-related page reload, the promise resolves with `null`).

Unless you want to store the *refresh token*, you usually don't have to do anything with the server response here, since the plugin handles the auth stuff for you.

#### 1.3.4 Refreshing the authentication
The token received during the auth process is only valid for a given time, usually in a range of hours. After this time, or when having a new browser session, you need to re-authenticate, either by restarting the auth process or by using a *refresh token*, that's included in the servers auth response.

So if you want to use the *refresh token* for re-authentication, you have to persist it when you get the servers auth response. Please mind that the *refresh token* for a health record is considered sensible information and has to be saved securely.

```javascript
let refreshToken;
fhir.handleAuthResponse()
.then(res => {
  // check if the response is not null
  if(res){
    // we are authenticated
    // ... and can keep refreshToken
    this.refreshToken = res.refresh_token;
  }
})
.catch(err => {
  // oops, something went wrong
  console.log(err);
});

// now we can use the refresh token later for re-authentication
fhir.refreshAuth(refreshToken)
.then(res => {/* do something*/})
.catch(err => {/* do something */});
```

The refresh token is only valid once, so the `refreshAuth()` method also returns a promise with the server response, including a new refresh token. Of course, you can save this new refresh token the same way as you did when calling `handleAuthResponse()`.

<a name="1.4-methods"></a>
## 1.4 Methods
The following table describes all the methods intended for public use.

| Function            | Description                            | Params | Returns |  
| ---                 | ---                                    | ---    |---      |
|authenticate()     |Starts the two-step authentication process (see [1.3.1](#1.3.1-authStart)).|none |nothing<br/>(but redirects to the servers auth page) |
|handleAuthResponse()|Handles the callback by the auth server. Has to be called when loading the page by the *redirect_url* (see [1.2.1](#1.2.1-constructor)). The returned auth token is handled by the plugin and does not require further action.|none|A promise that resolves to <br/>a) the servers response when in the auth process and the request was successful (HTTP status 200 / 201)<br/>b) null when not in the auth process or <br/>c) rejects with an error message when in the auth process and an error occurred|
refreshAuth(*rToken*)  |Refreshes the authentication with a refresh token. The returned auth token is handled by the plugin and does not require further action.| *rToken*: a refresh token that was saved from an earlier servers auth response.|A promise that <br/>resolves to the servers response (including a new refresh token) or <br/>rejects with an error message.|
isLoggedIn()          |Checks if an auth token is set and not expired.|none|*true* if a token is set and not yet expired, *false* if no token is set or it is expired.|
logout()              |Logs out the user by deleting all the authentication information|none|nothing|
create(*resource*)    |Creates a new resource on the FHIR server.|*resource*: the resource to create.|A promise that: <br/>resolves with the created resource if successful (HTTP status 200 / 201), or <br/>rejects with an error message.|
update(*resource*)    |Updates an existing resource on the FHIR server.|*resource*: the resource to update. Note that the *resource.id* must be set and correct.|A promise that:<br/>resolves with the updated resource if successful (HTTP status 200 / 201), or <br/>rejects with an error message.|
search(*resourceType*, *params*)|Searches for resources on the server.|*resourceType*: the resource type to look up.<br/>*params*: the FHIR search parameters (see [hl7.org](https://www.hl7.org/fhir/search.html) for details)|A promise that:<br/>a) resolves to the servers response (a FHIR bundle with the search results) if sucessful or<br/>b) rejects with an error message.|
setLanguage(*lang*)   |Sets the language used for the servers auth window (if supported serverside).|*lang*: The abbreviation of the wanted language (e.g. `'en'`, `'de'`, `'fr'` or `'it'`).|nothing|
setConformanceUrl(*url*)|Manually sets the conformance URL. Only necessary if it deviates from the standard `myserver.net/fhir/metadata` scheme, as this is generated as a default.|*url*: the servers conformance URL.|nothing|
setScope(*scope*)|Manually sets the scope. Only necessary if scope differs from the default `user/*.*`.|*scope*: the desired scope. |nothing|

<a name="1.5-examples"></a>
## 1.5 Examples
### 1.5.1 Search
Searching for resources returns a bundle with all resources matching the search criteria (in the example: all resources of type "Observation" since the Titanic sank on April 15th in 1912.)
```javascript
fhir.search('Observation', { date: 'ge1912-04-15' }).then((response) => {
  // response is now the server response with the resource in the body
  // only if status is 200 or 201

  // print the id of the first resource in the response bundle
  console.log(response.entry[0].resource.id);
}).catch((error) => {
  // here you can / have to handle everything that can go wrong.
  // (everything other than status 200 / 201)
});

```

### 1.5.2 Create
Creates a FHIR resource.
*IMPORTANT:* Do not forget to set the resourceType key!
```javascript
let myResource = {
  "resourceType": "Observation",
  /* ... */
}
fhir.create(myResource).then((response) => {
  // response is now the server response with the resource in the body
  // only if status is 200 or 201
  }).catch((error) => {
  // here you can / have to handle everything that can go wrong.
  // (everything other than status 200 / 201)
});

```

### 1.5.3 Update
Updates a FHIR resource.
*IMPORTANT:* Do not forget that you need the resource.id for updating
```javascript
fhir.update(myResource).then((response) => {
  // response is now the server response with the resource in the body
  // only if status is 200 or 201
  }).catch((error) => {
  // here you can / have to handle everything that can go wrong.
  // (everything other than status 200 / 201)
});
```
<a name="2-vue"></a>
## 2 Using with Vue.js
If you want to use jsOnFhir in a Vue.js project, it is recommended to declare the instance in your `main.js` and then make it available globally.

<a name="2.1-globalFhir"></a>
### 2.1 Make your jsOnFhir instance globally available
This is achieved by adding a getter function for the jsOnFhir instance to the Vue prototype. Your `main.js` then should look like this:
```javascript
import Vue from 'vue'
import App from './App.vue'


/* snip: insert this to your main.js */
// import JSonFhir after installing it from npm
import { JSOnFhir } from '@i4mi/js-on-fhir'
// declare a constant with your correct parameters
const fhir = new JSOnFhir('server_url', 'client_id', 'redirect_url');
// attach a getter function to the Vue prototype to make it globally available
Object.defineProperties(Vue.prototype, {
  $fhir: {
    get: function() {
      return fhir;
    }
  }
});
/* snap */


Vue.config.productionTip = false
new Vue({
  render: function (h) { return h(App) },
}).$mount('#app')
```

Since every component extends the Vue class, the getter is available and gives you access to the same jsOnFhir instance:
```javascript
let loggedIn = this.$fhir.isLoggedIn();
```
 now works in every of your components, without the need to import the package or initialize a new jsOnFhir.

<a name="2.2-twoStepAuth"></a>
### 2.2 Handle the two-step auth process
For handling the two-step auth process, you have to include the `handleAuthResponse()` method into the mounted() section on the root view of your project (or whatever page you pointed the *redirect_url* to). In a default Vue project, this would be `App.vue`.
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
You then can call the `this.$fhir.authenticate()` method from anywhere in your project, which takes the user to the servers auth page and further to the defined *redirect_url* (which is your `App.vue`), where the auth response is handled.


### 2.3 Demo app
A demonstration of the most important functions and the implementation in a Vue.js project can be seen in a simple demo app available on [github/heg/vue-fhir-demo](https://github.com/heg2/vue-fhir-demo).

 <a name="3-dev"></a>
## 3 Dev
If you want to contribute to the plugin, you can clone the repository from Github:  
`git clone https://github.com/i4mi/fhir-wrappers.ts.git`

Then checkout the `development` branch (or directly clone it: `git clone -b develop https://github.com/i4mi/fhir-wrappers.ts.git`).

Then create your own branch with a title, according the feature you want to implement!

install (dev) dependencies
`npm install --save`

build  
`npm run build`

publish: login with i4mi account  
`npm publish --access public`

 <a name="4-issues"></a>
## 4 Submit issues
Go to the global repo issue site on [GitHub](https://github.com/i4mi/fhir-wrappers.ts/issues).

Create a new issue with the label ![][~web].

[~web]: https://img.shields.io/static/v1?label=-->&message=WEB&color=green
