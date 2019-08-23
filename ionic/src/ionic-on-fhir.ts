import { apiCall, ApiCallArgs, ApiCallResponse, HttpMethod } from '@i4mi/fhir_r4';
import { InAppBrowser, InAppBrowserObject } from '@ionic-native/in-app-browser/ngx';
import { SecureStorage, SecureStorageObject } from '@ionic-native/secure-storage/ngx';
import { AuthRequest, AuthResponse, TokenExchangeRequest, TokenRequest, AUTH_RES_KEY } from './typeDefinitions';
import { HttpParams } from '@angular/common/http';

const jsSHA = require('jssha');


export class IonicOnFhir {
    // plugins, libs and interfaces
    apiCallArgs: ApiCallArgs;
    authWindow: InAppBrowserObject;
    authRequestParams: AuthRequest;
    authResponseParams: AuthResponse;
    tokenExchangeParams: TokenExchangeRequest;

    // urls
    conformanceStatementUrl: string;

    // temp state for auth
    stateHash: string;

    // storage and temp
    storage: SecureStorageObject;

    constructor(private fhirServerUrl: string,
                private clientId: string,
                private iab: InAppBrowser,
                private secStorage: SecureStorage) {

        this.authRequestParams.client_id = this.clientId;
        this.tokenExchangeParams.client_id = this.clientId;

        this.authRequestParams.scope = 'user/*.*';
        this.authRequestParams.aud = '/fhir';
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
     * 
     */
    authenticate(): Promise<any> {

        this.authRequestParams.redirect_uri = 'http://localhost/callback';

        // function that executes the authentication
        // according oAuth 2 from SMART on FHIR
        // @returns error on rejectu
        const doAuthentication = (url: string): Promise<any> => {
            return new Promise((resolve, reject) => {
                let autoClose = false;

                this.authWindow = this.iab.create(url, '_blank', 'location=no,clearcache=yes');
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
                    `&client_id=${this.authRequestParams.response_type}` +
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
     * function that interprets the result of the api request
     */
    private interpretTokenResponse = (response: ApiCallResponse): Promise<any> => {
        return new Promise((resolve, reject) => {
            if (response.status === 200) {
                // override body with parsed response
                // todo --> try to map oject from lib
                response.body = JSON.parse(response.body);
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
                const tokenRequestParams = new HttpParams();

                if (typeof this.tokenExchangeParams.redirect_uri === 'undefined') {
                    this.tokenExchangeParams.redirect_uri = (this.authRequestParams.redirect_uri) ? this.authRequestParams.redirect_uri : 'http://localhost/callback';
                }

                tokenRequestParams.append('grant_type', this.tokenExchangeParams.grant_type);
                tokenRequestParams.append('code', this.tokenExchangeParams.code);
                tokenRequestParams.append('redirect_uri', this.tokenExchangeParams.redirect_uri);
                tokenRequestParams.append('client_id', this.tokenExchangeParams.client_id);

                return { encodedParams: tokenRequestParams };
            };

            const exchangeToken = (): Promise<ApiCallResponse> => {
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
                        return this.interpretTokenResponse(response);
                    }).then((response) => {
                        res(response.body);
                    }).catch((error) => {
                        rej(error);
                    });
                });
            };

            exchangeToken().then((response) => {
                return this.saveAuthResponse(response);
            }).then((response) => {
                resolve(response);
            }).catch((error) => {
                reject(error);
            });

        });
    }

    /**
     * Saves given response body in the secure storage
     */
    private saveAuthResponse(response: ApiCallResponse): Promise<any> {
        return new Promise((resolve, reject) => {
            this.checkIfDeviceSecure().then(() => {
                this.storage.set(AUTH_RES_KEY, JSON.stringify(response.body)).then(() => {
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


