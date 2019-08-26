# IN DEVELOPMENT! -- DO NOT USE --

## Dev
clone repo  
`https://github.com/i4mi/fhir-wrappers.ts.git`

checkout dev branch. Then create your own with title of feature you implement!

build  
`npm run build`

publish: login with i4mi account  
`npm publish --access public`

## Usage

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
**IN PROGRESS**
After import, we need to set following params: 
```typescript
...
const ...

myInitFunction() {
    this.myLib.initIonicOnFhir('', '', '')
}
```

### Authenticate
After init before you can do any other action, you have to call authenticate on the server configured:
```typescript
...

myAuthFunction() {
    return new Promise((resolve, reject) => {
        // if no networ, return no network error
        if (this.networkService.networkState) {
            // gets metadata xml from midata to know auth and token endpoint url
            return this.midataLib.authenticate().then((response) => {
                console.log(response);
            }).catch((error) => {
                console.error(error);
            });
        } else {
            return reject(`MidataService, no connection`);
        }
    });
}
```

### Search
Searching for a fhir resource
```typescript
...
mySearch() {
    this.midataLib('Observation', { id: '123131231asfdasd21813' }).then((response) => {
        // response is now the server response with the resource in the body
        // only if status is 20X
    }).catch((error) => {
        // all errors get rejected until we are here. so you can/have to handle everything that can get wrong here.
        // everything other than status 20X
    });
}
```

Wrapper for the I4MI fhir-resource-r4 library.  
This library handles the oAuth 2.0 process for an `ionic 4` app.