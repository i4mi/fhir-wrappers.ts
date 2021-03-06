# @i4mi/ionic-on-fhir FHIR® Library with oAuth 2.0 for Ionic apps

_➰ Use at own risk ➰_

![][~license]
![][~issues]


Wrapper for the [I4MI fhir-resource-r4](https://github.com/i4mi/fhir-resources-r4) library.  
This is an ionic library for handling the oAuth 2.0 process for an [ionic 4/5](https://ionicframework.com/) app. So you can easily create a SMART on FHIR App and connect your app to a FHIR server. See usage guide below on how to use.

# Content
1. [Usage](#1-Usage)  
  1.1 [Install package](#11-Install-package)  
  1.2 [Install dependencies](#12-Install-dependencies)  
  1.3 [Import](#13-Import)  
  1.4 [Initialize module](#14-Initialize-module)  
  1.5 [Authenticate and session refresh](#15-Authenticate-and-session-refresh)  
  1.6 [Methods](#16-Methods)  
  1.7 [Examples](#17-Examples)
2. [Dev](#2-Dev)
3. [Submit issues](#3-Submit-issues)

# 1 Usage

Please keep in mind that `@i4mi/ionic-on-fhir` currently only works when running Ionic on a device or emulator. The authentification workflow is not supported when running Ionic in a browser using `ionic serve`.

If you're developping an Ionic application which is targeted to run in the browser, consider using the [I4MI js-on-fhir](https://github.com/i4mi/fhir-wrappers.ts/tree/master/web) library.

If your project is targeted to run as an Ionic app on iOS and / or Android devices, use real devices or emulators for testing (here, the `ionic cordova run android --livereload` argument comes in handy).

## 1.1 Install package
Install package with:  
`npm i @i4mi/ionic-on-fhir`

## 1.2 Install dependencies
__IMPORTANT:__  
Install the in app browser plugin before using this library:
```
$ npm i @ionic-native/in-app-browser
$ npm i @ionic-native/secure-storage

$ ionic cordova plugin add cordova-plugin-inappbrowser  
$ ionic cordova plugin add cordova-plugin-secure-storage-echo
```

### 1.3 Import
After installing the lib and it's dependencies, you have to import the library. Once globally and once in the page/service you're going to use the library.  
__Global:__  
To use `ionic-on-fhir`, add following import statement in `app.module.ts`:  
```typescript
import { IonicOnFhirModule } from '@i4mi/ionic-on-fhir';

@NgModule({
    imports: [
        IonicOnFhirModule
    ],
})
```

__Page/Service:__   
Then add the service where you need it in the constructor of your page/service:
```typescript
import { IonicOnFhirService } from '@i4mi/ionic-on-fhir';

constructor(private ionicOnFhir: IonicOnFhirService) {}
```

## 1.4 Initialize module
Before you can use the library, you need to initialize it with the command `initIonicOnFhir(...)`.  
```typescript
this.ionicOnFhir.initIonicOnFhir('server_url', 'client_id');
```
the parameters correspond to:

* _server_url_: the url of the fhir server you want to communicate with (ex: https://test.midata.coop)
* _client_id_: The client id of your app (server internal app name)

### 1.4.1 Misc config
There are some configuration possibilities, which you can/have-to use before the authentication process starts.
Possible functions:  

| Function           | Params                            | Description |  
| ---                | ---                               | --- |  
| configInAppBrowser | `Array<{ key: 'X', value: 'Y' }>` | Customize your in app browser with your own config! Look up all keys @ [the documentation](https://github.com/apache/cordova-plugin-inappbrowser)      |  
| differentiateConformanceStatementUrl | url as string   | If the url where to get the conformance statement (auth n token url) diverges from the pattern `[fhirServerUrl]/fhir/metadata` you have to set it here          |  
| differentiateScope | scope as string                   | If you want another scope than `user/*.*`, here is the function for it                                                                                              |  
| differentiateAud   | aud as string                     | If the url for your api calls diverges from `/fhir` here is the function to set it                                                                               |
| differentiateContentType   | content-type as string                     | If the content type (or accept) of your fhir server is another than the default `application/fhir+json;fhirVersion=4.0` define it yourself   |

### 1.4.2 MIDATA config
If you're using MIDATA as a FHIR server, make sure to add `http://localhost` to your allowed redirect URIs.

## 1.5 Authenticate and session refresh
Before you can read or write to the FHIR server, you need to authenticate with OAuth2.0. This is a two-step process. This library will handle the whole process for you. Furthermore, if you're already logged in the library can refresh your session.

### 1.5.1 Authenticate
Call authenticate on the server configured:
```typescript
this.ionicOnFhir.authenticate();
```
When you need to pass URL parameters to the authentification service, you can do so by passing them to the function call as an object. For example, if you want to add the parameter `isnew` with the value `never`, you can call authenticate like this:
```typescript
this.ionicOnFhir.authenticate({isnew: 'never'});
```

### 1.5.2 Session refresh
Your application needs to check and handle the expires_in time. Now the user does not want to get logged out after every x hours/minutes/seconds. So there is a need to refresh the session.
```typescript
this.ionicOnFhir.refreshSession();
```

# 1.6 Methods
The following table describes all the methods intended for public use (excluding the functions from chapter [1.4.1 Misc config](#1.4.1-Misc-config)).

| Function | Description | Parameters | Returns |
| --- | --- | --- | ---- |
| initIonicOnFhir(_fhirServerUrl_, _clientId_) | Set values the library needs for the authentication process. | _fhirServerUrl_: The url to the server (for example test.midata.coop)<br />_clientId_: App name given to the auth request as client id | nothing |
| authenticate() | Opens InAppBrowser and executes the oAuth2.0 process (see [1.5.1](#1.5.1-Authenticate)). | _params?_ (optional): Object of URL parameters that are passed on when opening the Auth URL in the InAppBrowser  | Promise with the auth response: <br/>`{`<br/>`    "state":"none",`<br/>`    "access_token":"oSkJQeiTxx4iiK...hqKhFp2Jj5u6DtQmj1bejdWLoYSX2kNq",`<br/>`    "token_type":"Bearer",`<br/>`    "scope":"user/*.*",`<br/>`    "expires_in":99999,`<br/>`    "patient":"56ded6c179c7212042b29984",`<br/>`    "refresh_token":"SZ7WF5diFgp...EKhNguO5do8faZG26kPdtYj9yRzlkX28HSrMfXftl"`<br/>`}` |
| refreshSession() | Tries to refresh the authentication token by authorizing with the help of the refresh token. | none | Promise with the auth response: <br/>`{`<br/>`    "state":"none",`<br/>`    "access_token":"oSkJQeiTxx4iiK...hqKhFp2Jj5u6DtQmj1bejdWLoYSX2kNq",`<br/>`    "token_type":"Bearer",`<br/>`    "scope":"user/*.*",`<br/>`    "expires_in":99999,`<br/>`    "patient":"56ded6c179c7212042b29984",`<br/>`    "refresh_token":"SZ7WF5diFgp...EKhNguO5do8faZG26kPdtYj9yRzlkX28HSrMfXftl"`<br/>`}` |
| logout() | Destroys all auth information. | none | Promise containing destroyed information |
| create(_resource_) | Creates a new resource on the FHIR server. | _resource_: the resource to create | A Promise that: <br/> _resolves_ with the created resource if successful (HTTP status 200 / 201), or <br/> _rejects_ with an error message. |
| update(_resource_) | Updates an existing resource on the FHIR server. | _resource_: the resource to update. Note that the `resource.id` must be set and correct. | A Promise that: <br/> _resolves_ with the created resource if successful (HTTP status 200 / 201), or <br/> _rejects_ with an error message. |
| search(_resourceType_, _params_) | Searches for an existing resource on the FHIR server with the given params.| _resourceType_: the resource type to look up.<br />_params_: the FHIR search parameters (see [documentation](https://www.hl7.org/fhir/resourcelist.html) of corresponding resource for details)| A Promise that: <br/> _resolves_  to the servers response (a FHIR bundle with the search results) if successful, or <br/> _rejects_ with an error message. |

# 1.7 Examples
### 1.7.1 Authenticate
```typescript
myAuthFunction() {
  this.ionicOnFhir.authenticate().then((response) => {
      console.log(response);
  }).catch((error) => {
      console.error(error);
  });
}
```

### 1.7.2 Session refresh
```typescript
myRefreshFunction() {
  this.ionicOnFhir.refreshSession().then((response) => {
      console.log(response);
  }).catch((error) => {
      console.error(error);
  });
}
```

### 1.7.3 Search
Searching for a fhir "Observation" resource with the id "123131231asfdasd21813":
```typescript
mySearch() {
    this.ionicOnFhir.search('Observation', { _id: '123131231asfdasd21813' }).then((response) => {
        // response is now the server response with the resource in the body
        // only if status is 20X
    }).catch((error) => {
        // all errors get rejected until we are here. so you can/have to handle everything that can get wrong here.
        // everything other than status 20X
    });
}
```

### 1.7.4 Create
Create for a fhir resource.
With this library, the fhir-resource-r4 library of the I4MI will automatically get installed as well. Therefore, we can now the interfaces given by this lib and you will always have a valid resource (this does not necessarily mean that you server can interpret it!)
*IMPORTANT:* Do not forget to set the resourceType key!
```typescript
myCreate(validResource: Resource) {
    this.ionicOnFhir.create(Resource).then((response) => {
        // response is now the server response with the resource in the body
        // only if status is 20X
    }).catch((error) => {
        // all errors get rejected until we are here. so you can/have to handle everything that can get wrong here.
        // everything other than status 20X
    });
}
```

### 1.7.5 Update
Updates a fhir resource.
*IMPORTANT:* Do not forget that you need the resource.id for making and update
```typescript
myUpdate(validResource: Resource) {
    this.ionicOnFhir.update(Resource).then((response) => {
        // response is now the server response with the resource in the body
        // only if status is 20X
    }).catch((error) => {
        // all errors get rejected until we are here. so you can/have to handle everything that can get wrong here.
        // everything other than status 20X
    });
}
```

# 2 Dev
clone repo  
`https://github.com/i4mi/fhir-wrappers.ts.git`

checkout dev branch. Then create your own branch with a chosen title according the feature you implement!

install (dev) dependencies
`npm install --save`

build  
`npm run build`

publish: login with i4mi account  
`npm publish --access public`

# 3 Submit issues
Go to the global repo issue site
`https://github.com/i4mi/fhir-wrappers.ts/issues`

Create a new issue with the label ![][~ionic].

-----
FHIR® is the registered trademark of HL7 and is used with the permission of HL7. Use of the FHIR trademark does not constitute endorsement of this product by HL7.

[~ionic]: https://img.shields.io/static/v1?label=-->&message=IONIC&color=blue

[~issues]: https://img.shields.io/github/issues-raw/i4mi/fhir-wrappers.ts/ionic

[~license]: https://img.shields.io/static/v1?label=license&message=Apache-2.0&color=blue
