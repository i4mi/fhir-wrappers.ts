import { apiCall, ApiCallArgs, ApiCallResponse, HttpMethod, ApiMethods, ApiConfig } from '@i4mi/fhir_r4';
import { InAppBrowser, InAppBrowserObject } from '@ionic-native/in-app-browser/ngx';
import { SecureStorage, SecureStorageObject } from '@ionic-native/secure-storage/ngx';
import { AuthRequest, AuthResponse, TokenExchangeRequest, TokenRequest, AUTH_RES_KEY, InAppBrowserSettings } from './ionic-on-fhir.types';
import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Resource } from '@i4mi/fhir_r4/dist/definition';

const jsSHA = require('jssha');

@Injectable({
    providedIn: 'root'
})
export class IonicOnFhirService {
    // plugins, libs and interfaces
    private authWindow: InAppBrowserObject;
    private authRequestParams: AuthRequest = {
        client_id: '',
        auth_url: '',
        response_type: 'code',
        redirect_uri: '',
        state: '',
        scope: '',
        aud: ''
    };
    private authResponseParams: AuthResponse = {
        access_token: '',
        expires_in: 0,
        patient: '',
        refresh_token: '',
        scope: '',
        state: '',
        token_type: 'Bearer'
    };
    private tokenExchangeParams: TokenExchangeRequest = {
        client_id: '',
        code: '',
        redirect_uri: '',
        token_url: ''
    };

    // urls
    private conformanceStatementUrl: string;
    private fhirServerUrl: string;

    // temp state for auth
    private stateHash: string;

    // storage
    private storage: SecureStorageObject;

    // settings for iab
    private iabSettings: Array<InAppBrowserSettings>;

    // params to get for user
    private loggedIn: boolean = false;

    // api methods
    private apiMethods: ApiMethods;

    constructor(private iab: InAppBrowser,
                private secStorage: SecureStorage) {

    }

    /**
     * First to call.
     * Set values the library needs for the authentication process.
     * @param fhirServerUrl The url to the server (for example test.midata.coop)
     * @param clientId App name given to the auth request as client id
     */
    initIonicOnFhir(fhirServerUrl: string, clientId: string) {
        this.fhirServerUrl = fhirServerUrl;

        this.authRequestParams.client_id = clientId;
        this.tokenExchangeParams.client_id = clientId;

        this.authRequestParams.scope = 'user/*.*';
        this.authRequestParams.aud = '/fhir';

        this.apiMethods = new ApiMethods();
    }

    /**
     * Checks if user is logged in
     * @returns boolean (true if logged in)
     */
    isLoggedIn(): boolean {
        return this.loggedIn;
    }

    /**
     * Config params for in app browser as array<{key:value}>
     * Call when you do not want default settings
     * @param settings: Array<InAppBrowserSettings> Array of inappbrowser settings. Documented here:
     * https://github.com/apache/cordova-plugin-inappbrowser
     */
    configInAppBrowser(settings: Array<InAppBrowserSettings>) {
        this.iabSettings = settings;
    }
    
    /**
     * Function that lets you define a different content type for you fhir server 
     * than the default type of the lib. Default: "application/fhir+json;fhirVersion=4.0"
     * @param contentType content type for header param
     */
    differentiateContentType(contentType: string) {
        this.apiMethods.differentiateContentType(contentType);
    }

    /**
     * Function that lets you define a different conformance endpoint url
     * if it diverges from standard pattern, which is serverUrl + "/fhir/metadata"
     * @param url of the conformance statement endpoint
     */
    differentiateConformanceStatementUrl(url: string) {
        this.conformanceStatementUrl = url;
    }

    /**
     * Function to differentiate from the default scope
     * 'user/*.*'
     * @param scope Scope of logged in user
     */
    differentiateScope(scope: string) {
        this.authRequestParams.scope = scope;
    }

    /**
     * Function to differentiate from the default aud
     * '/fhir'
     * @param scope Scope of logged in user
     */
    differentiateAud(aud: string) {
        this.authRequestParams.aud = aud;
    }

    /**
     * Authenticate someone over oAuth2
     * @returns Promise<any> -
     * if success: returns auth response (type AuthResponse) and saves response to secure storage  
     * else: error message
     */
    authenticate(): Promise<any> {
        this.authRequestParams.redirect_uri = 'http://localhost/callback';

        // function that executes the authentication
        // according oAuth 2 from SMART on FHIR
        // @returns error on rejectu
        const doAuthentication = (url: string): Promise<any> => {
            return new Promise((resolve, reject) => {
                if (typeof this.fhirServerUrl === 'undefined') {
                    reject('Ionic On FHIR: Plase call initIonicOnFhir first to define the necessairy configurations');
                }

                let autoClose = false;
                let effectiveIabSettings = 'location=no,clearcache=yes';
                if (typeof this.iabSettings !== undefined) {
                    effectiveIabSettings = '';
                    this.iabSettings.forEach((setting, index) => {
                        effectiveIabSettings += `${setting.key}=${setting.value}`;

                        // if not last element, add ','
                        if (index !== this.iabSettings.length -1) {
                            effectiveIabSettings += ',';
                        }
                    });
                }

                this.authWindow = this.iab.create(url, '_blank', effectiveIabSettings);
                // subscribe loadstart event to show iab
                this.authWindow.on('loadstart').subscribe((event) => {
                    this.authWindow.show();
                    // if no redirect uri is given, close browser and reject
                    if ((event.url).indexOf(this.authRequestParams.redirect_uri) === 0) {
                        const state = event.url.split('&')[0].split('=')[1];
                        autoClose = true;
                        // if returned state same as request state, resolve
                        if (state === this.authRequestParams.state) {
                            this.tokenExchangeParams.code = event.url.split('&')[1].split('=')[1];
                            this.authWindow.close();
                            resolve();
                        } else {
                            this.authWindow.close();
                            reject(`State received by server not equals sent one.`);
                        }
                    }
                }, (error) => {
                    reject(`An error occured on loadstart event: ${error}`);
                });

                // subscribe exit event to check when browser gets closed
                this.authWindow.on('exit').subscribe(() => {
                    if (!autoClose) {
                        reject(`Someone or something caused the browser to close`);
                    }
                });
            });
        };

        return new Promise((resolve, reject) => {
            // now fetches conformance statement
            this.fetchConformanceStatement().then((response) => {
                this.initSession();
                // creates auth url
                let authUrl = `${this.authRequestParams.auth_url}` +
                    `?response_type=${this.authRequestParams.response_type}` +
                    `&client_id=${this.authRequestParams.client_id}` +
                    `&redirect_uri=${this.authRequestParams.redirect_uri}` +
                    `&aud=${this.authRequestParams.aud}` +
                    `&scope=${this.authRequestParams.scope}` +
                    `&state=${this.authRequestParams.state}`;

                if (typeof this.authRequestParams.launch !== 'undefined') {
                    authUrl += `&launch=${this.authRequestParams.launch}`;
                }

                const encodedUrl = encodeURI(authUrl);

                // now execute effective authentication
                doAuthentication(encodedUrl).then(() => {
                    return this.exchangeTokenForCode();
                }).then((resp) => {
                    resolve(resp);
                }).catch((error) => {
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * Refresh session and refreshes it, if user was logged in.
     * Tries to refresh the authentication token by authorizing with the help of the refresh token. 
     * This will generate a new authentication as well as a new refresh token. On successful refresh, 
     * the old refresh_token will be invalid and both the access_token and the refresh_token will be overwritten. 
     * Previous access_tokens will remain valid until their expiration timestamp is exceeded.
     * @returns resolves the auth response if success
     * @returns reject every other case
     */
    refreshSession(): Promise<any> {
        // function to get the params for the refresh request
        const defineParameters = (): Promise<TokenRequest> => {
            return new Promise((resolve, reject) => {
                let urlParams = new URLSearchParams();
                urlParams.append('grant_type', 'refresh_token');
    
                if (!this.authResponseParams.refresh_token) {
                    this.getAuthResponse().then((result: AuthResponse) => {
                        urlParams.append('refresh_token', result.refresh_token);
                        resolve({  encodedParams: urlParams });
                    }).catch((error) => {
                        reject(error);
                    });
                } else {
                    urlParams.append('refresh_token', this.authResponseParams.refresh_token);
                    resolve({  encodedParams: urlParams });
                }
            });
        };

        // do refresh
        const doSessionRefresh = (refeshParam): Promise<any> => {
            return new Promise((resolve, reject) => {
                apiCall({
                    url: this.tokenExchangeParams.token_url,
                    method: HttpMethod.POST,
                    payload: refeshParam.encodedParams.toString(),
                    jsonBody: true,
                    jsonEncoded: false,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }).then((response) => {
                    resolve(response);
                }).catch((error) => {
                    reject(error);
                })
            });
        }

        return new Promise((resolve, reject) => {
            // Gets conformance statement
            this.fetchConformanceStatement().then(() => {
                return defineParameters();
            }).then((params) => {
                return doSessionRefresh(params);   
            }).then((response) => {
                if (response.status === 200) {
                    let refreshResponse: AuthResponse = response.body;
                    this.saveAuthResponse(refreshResponse).then(() => {
                        resolve(refreshResponse);
                    }).catch((error) => {
                        reject(error);
                    }); 
                } else {
                    reject(response);
                }
            }).catch((error) => {
                reject(error);
            })
        });
    }

    /**
     * Destroys all auth information from storage
     * and sets logged in to false
     */
    logout(): Promise<any> {
        this.loggedIn = false;
        return new Promise((resolve, reject) => {
            this.storage.remove(AUTH_RES_KEY).then((res) => {
                resolve(res);
            }).catch((error) => {
                reject(error);
            })
        });
    }

    /**
     * Creates a resource
     * on the fhir server
     * @param resource resource to save
     * @returns resolve of resource as JSON if status 200 or 201
     * @returns reject every other case with message
     */
    create(resource: Resource | any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.storage.get(AUTH_RES_KEY).then((res) => {
                // checks if logged in and has auth token
                if (!this.loggedIn && !res) {
                    reject('Not logged in');
                }

                // configs parameters according apimethods
                const authParams: AuthResponse = JSON.parse(res);
                const config: ApiConfig = {
                    access_token: authParams.access_token,
                    authorization_type: 'Bearer',
                    base_url: `${this.fhirServerUrl}/fhir`
                }

                // calls create of apimethods
                this.apiMethods.create(resource, config).then((response) => {
                    if (response.status === 200 || response.status === 201)
                        resolve(response.body);
                    else  
                        reject(response);
                }).catch((error) => {
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * Updates a resource
     * on the fhir server
     * @param resource resource to update
     * @returns resolve of resource as JSON if status 200 or 201
     * @returns reject every other case with message
     */
    update(resource: Resource | any): Promise<any> {
        return new Promise((resolve, reject) => {
                    // checks if resource has id
            if (typeof resource.id === 'undefined' &&
                typeof resource._id === 'undefined') {

                reject('Resource has no id');
            }
            this.storage.get(AUTH_RES_KEY).then((res) => {
                // checks if logged in and has auth token
                if (!this.loggedIn && !res) {
                    reject('Not logged in');
                }

                // configs parameters according apimethods
                const authParams: AuthResponse = JSON.parse(res);
                const config: ApiConfig = {
                    access_token: authParams.access_token,
                    authorization_type: 'Bearer',
                    base_url: `${this.fhirServerUrl}/fhir`
                }

                // calls update of apimethods
                this.apiMethods.update(resource, config).then((response) => {
                    if (response.status === 200 || response.status === 201)
                        resolve(response.body);
                    else  
                        reject(response);
                }).catch((error) => {
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * Searches for one or multiple resources
     * @param resourceType resource type to look up 
     * @param params search parameters according fhir resource guide$
     * @returns resolve of resource as JSON if status 200 or 201
     * @returns reject every other case with message
     */
    search(resourceType: string, params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.storage.get(AUTH_RES_KEY).then((res) => {
                // checks if logged in and has auth token
                if (!this.loggedIn && !res) {
                    reject('Not logged in');
                }

                // configs parameters according apimethods
                const authParams: AuthResponse = JSON.parse(res);
                const config: ApiConfig = {
                    access_token: authParams.access_token,
                    authorization_type: 'Bearer',
                    base_url: `${this.fhirServerUrl}/fhir`
                }

                // calls search of apimethods
                this.apiMethods.search(params, resourceType, config).then((response) => {
                    if (response.status === 200 || response.status === 201)
                        resolve(response.body);
                    else  
                        reject(response);
                }).catch((error) => {
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });
        });
    }
    
    /**
     * Makes api call to get the auth and token url
     * from the fhir/midatata of the server.
     * Returns a json response with a resource in the .body
     * Rejects the original error if one occures
     */
    private fetchConformanceStatement(): Promise<any> {
        return new Promise((resolve, reject) => {
            const cfUrl = (typeof this.conformanceStatementUrl !== 'undefined') ? this.conformanceStatementUrl : `${this.fhirServerUrl}/fhir/metadata`;

            apiCall({
                url: cfUrl,
                method: HttpMethod.GET
            }).then((response: ApiCallResponse) => {
                return this.interpretConfirmantStatementResponse(response);
            }).then((resource) => {
                resolve(resource);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * function that interprets the result of the api request
     */
    private interpretConfirmantStatementResponse = (response: ApiCallResponse): Promise<any> => {
        return new Promise((resolve, reject) => {
            if (response.status === 200) {
                // override body with parsed response
                // todo --> try to map oject from lib
                response.body = JSON.parse(response.body);
                this.tokenExchangeParams.token_url = response.body.rest['0'].security.extension['0'].extension['0'].valueUri;
                this.authRequestParams.auth_url = response.body.rest['0'].security.extension['0'].extension['1'].valueUri;
                resolve(response);
            } else {
                reject(response);
            }
        });
    }

    /**
     * Inits a session:
     * State and state hash (jsSHA-256)
     */
    private initSession() {
        this.generateRandomState(128);
        const shaObj = new jsSHA('SHA-256', 'TEXT'); // create a SHA-256 Base64 hash out of the
        shaObj.update(this.authRequestParams.state); // generates hash out of state
        this.stateHash = shaObj.getHash('B64'); // transform the hash value into the Base64URL encoded
    }

    /**
     * Generates random state string with given length
     * If lengts set to 0, it will take 122
     * @param length length of the string to generate
     */
    private generateRandomState(length: number) {
        if (length <= 0) {
            length = 122;
        }
        const possibilities = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        this.authRequestParams.state = '';
        for (let i = 0; i < length; i++) {
            this.authRequestParams.state += possibilities.charAt(Math.floor(Math.random() * possibilities.length));
        }
    }

    /**
     * After successful authentication on midata this method is invoked. It exchanges the authCode
     * obtained from midata with the access_token used to query the FHIR endpoint API.
     */
    private exchangeTokenForCode(): Promise<any> {
        return new Promise((resolve, reject) => {
            const addTokenExchangeRequestPayload = (): TokenRequest => {
                let tokenRequestParams = new HttpParams();

                if (this.tokenExchangeParams.redirect_uri === '') {
                    this.tokenExchangeParams.redirect_uri = (this.authRequestParams.redirect_uri) ? this.authRequestParams.redirect_uri : 'http://localhost/callback';
                }

                tokenRequestParams = tokenRequestParams.append('grant_type', 'authorization_code');
                tokenRequestParams = tokenRequestParams.append('code', this.tokenExchangeParams.code);
                tokenRequestParams = tokenRequestParams.append('redirect_uri', this.tokenExchangeParams.redirect_uri);
                tokenRequestParams = tokenRequestParams.append('client_id', this.tokenExchangeParams.client_id);

                console.warn('Token request param', tokenRequestParams.toString());

                return { encodedParams: tokenRequestParams };
            };

            const exchangeToken = (): Promise<AuthResponse | any> => {
                return new Promise((res, rej) => {
                    apiCall({
                        url: this.tokenExchangeParams.token_url,
                        method: HttpMethod.POST,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        jsonBody: true,
                        payload: addTokenExchangeRequestPayload().encodedParams.toString(),
                        jsonEncoded: false
                    }).then((response: ApiCallResponse) => {
                        // returns body of response (so the AuthResponse)
                        return this.interpretTokenResponse(response);
                    }).then((response: AuthResponse) => {
                        res(response as AuthResponse);
                    }).catch((error) => {
                        rej(error);
                    });
                });
            };

            // from here on only response
            exchangeToken().then((response: AuthResponse) => {
                return this.saveAuthResponse(response);
            }).then((response) => {
                resolve(response);
            }).catch((error) => {
                reject(error);
            });

        });
    }

    /**
     * function that interprets the result of the api request
     */
    private interpretTokenResponse = (response: ApiCallResponse): Promise<AuthResponse | any> => {
        return new Promise((resolve, reject) => {
            if (response.status === 200) {
                // todo --> try to map oject from lib
                resolve(response.body as AuthResponse);
            } else {
                reject(response);
            }
        });
    }

    /**
     * Saves given response body in the secure storage
     */
    private saveAuthResponse(response: AuthResponse): Promise<any> {
        return new Promise((resolve, reject) => {
            this.checkIfDeviceSecure().then(() => {
                this.storage.set(AUTH_RES_KEY, JSON.stringify(response)).then(() => {
                    resolve(response);
                }).catch((error) => {
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * Loads the auth response if there was one (for refresh token etc.)
     */
    private getAuthResponse(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.checkIfDeviceSecure().then(() => {
                this.storage.get(AUTH_RES_KEY).then((response) => {
                    response = JSON.parse(response);
                    resolve(response);
                }).catch((error) => {
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * Checks if the device is secure or not
     */
    private checkIfDeviceSecure(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.secStorage.create(`${this.authRequestParams.client_id}_auth`).then((s) => {
                this.storage = s;
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
    }
}


