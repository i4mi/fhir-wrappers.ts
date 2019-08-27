# IN DEVELOPMENT! -- Use at your own risk ;) --

Wrapper for the I4MI fhir-resource-r4 library.  
This library handles the oAuth 2.0 process for an `ionic 4` app.

## Usage

### Install package
Install package with:
`npm i @i4mi/ionic-on-fhir`

### Install dependencies
**IMPORTANT**: Install the in app browser plugin before using this library:  
`ionic cordova plugin add cordova-plugin-inappbrowser`  
AND:  
`ionic cordova plugin add cordova-plugin-secure-storage`

### Import Module n Service
To use the library, add following import statement in `app.modules.ts`:  
```typescript
import { IonicOnFhirModule } from '@i4mi/ionic-on-fhir';

@NgModule({
    ...
    imports: [
        ...
        IonicOnFhirModule
    ],
    ...
})
...
```

Then add the service where you need it:
```typescript
import { IonicOnFhirService } from '@i4mi/ionic-on-fhir';

constructor(...
            private myLib: IonicOnFhirService
) {
    ...
}
```

### Init service with necessairy params
After import, we need to set following params: 
* [fhriServerUrl]: The url of the fhir server you want to communicate with (ex: https://test.midata.coop)
* [client_id]: The client id of your app (server internal app name)

```typescript
...

myInitFunction() {
    this.myLib.initIonicOnFhir([fhriServerUrl], [client_id]);
}

...
```

### Misc config before auth
There are some configuration possibilities, which you can/have-to use before the authentication process starts.
Possible functions:  


| Function           | Params                            | Description |  
| ---                | ---                               | --- |  
| configInAppBrowser | `Array<{ key: 'X', value: 'Y' }>` | Customize your in app browser with your own config! Look up all keys @ [the documentation](https://github.com/apache/cordova-plugin-inappbrowser)      |  
| differentiateConformanceStatementUrl | url as string   | If the url where to get the conformance statement (auth n token url) diverges from the pattern `[fhirServerUrl]/fhir/metadata` you have to set it here |  
| differentiateScope | scope as string                   | If you want another scope than `user/*.*`, here is the function for it                                                                                     |  
| differentiateAud   | aud as string                     | If the url for your api calls diverges from `/fhir` here is the function to set it                                                                     |



### Authenticate
After init before you can do any other action, you have to call authenticate on the server configured:
```typescript
...

myAuthFunction() {
    return new Promise((resolve, reject) => {
        // gets metadata xml from midata to know auth and token endpoint url
        return this.midataLib.authenticate().then((response) => {
            console.log(response);
            resolve(response);
        }).catch((error) => {
            console.error(error);
            reject(error);
        });
    });
}
```

### Search
Searching for a fhir resource
```typescript
...
mySearch() {
    this.midataLib.search('Observation', { id: '123131231asfdasd21813' }).then((response) => {
        // response is now the server response with the resource in the body
        // only if status is 20X
    }).catch((error) => {
        // all errors get rejected until we are here. so you can/have to handle everything that can get wrong here.
        // everything other than status 20X
    });
}
```

### Create
Create for a fhir resource.
With this library, the fhir-resource-r4 library of the I4MI will automatically get installed as well. Therefore, we can now the interfaces given by this lib and you will always have a valid resource (this does not necessarily mean that you server can interpret it!)
*IMPORTANT:* Do not forget to set the resourceType key!
```typescript
...
myCreate(validResource: Resource) {
    this.midataLib.create(Resource).then((response) => {
        // response is now the server response with the resource in the body
        // only if status is 20X
    }).catch((error) => {
        // all errors get rejected until we are here. so you can/have to handle everything that can get wrong here.
        // everything other than status 20X
    });
}
```

### Update
Updates a fhir resource.
*IMPORTANT:* Do not forget that you need the resource.id for making and update
```typescript
...
myUpdate(validResource: Resource) {
    this.midataLib.update(Resource).then((response) => {
        // response is now the server response with the resource in the body
        // only if status is 20X
    }).catch((error) => {
        // all errors get rejected until we are here. so you can/have to handle everything that can get wrong here.
        // everything other than status 20X
    });
}
```

## Dev
clone repo  
`https://github.com/i4mi/fhir-wrappers.ts.git`

checkout dev branch. Then create your own branch with a choosen title according the feature you implement!

install (dev) dependencies
`npm install --save`

build  
`npm run build`

publish: login with i4mi account  
`npm publish --access public`

## Submit issues
Go to the global repo issue site
`https://github.com/i4mi/fhir-wrappers.ts/issues`

Create a new issue with the label ![][~ionic].

[~ionic]: https://img.shields.io/static/v1?label=-->&message=IONIC&color=blue


| Command | Description |
| --- | --- |
| git status | List all new or modified files |
| git diff | Show file differences that haven't been staged |
