import { apiCall, HttpMethod, ApiMethods, ApiConfig, ApiCallResponse, Resource, Bundle } from '@i4mi/fhir_r4';
import forge from 'node-forge';
/**
 * A response to successful oauth request
 * ACCORDING http://www.hl7.org/fhir/smart-app-launch/index.html
 */
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

export enum FHIR_VERSION {
  'STU3' = '3.0.2',
  'R4' = '4.0.1',
  'R4B' = '4.3.0',
  'R5' = '5.0.0'
}

interface StorageObject {
  urls: {
    service: string;
    conformance: string;
    auth: string;
    redirect: string;
    token: string;
  };
  auth: {
    accessToken: string;
    expires: number;
    type: string;
    refreshToken: string;
  };
  settings: {
    client: string;
    userId: string;
    scope: string;
    state: string;
    language: string;
    supportedResourceTypes: string[];
    fhirVersion: FHIR_VERSION;
    responseType: string;
    noAuth: boolean;
    noPkce: boolean;
    codeVerifier: string;
    codeChallenge: string;
  };
}

const DEFAULT_SETTINGS: StorageObject = {
  urls: {
    service: '',
    conformance: '',
    auth: '',
    redirect: '',
    token: ''
  },
  settings: {
    client: '',
    userId: '',
    scope: '',
    state: '',
    language: '',
    supportedResourceTypes: new Array<string>(),
    fhirVersion: FHIR_VERSION.R4,
    responseType: 'code',
    noAuth: false,
    noPkce: false,
    codeVerifier: '',
    codeChallenge: ''
  },
  auth: {
    accessToken: '',
    expires: 0,
    type: '',
    refreshToken: ''
  }
};

export class JSOnFhir {
  private iife = (() => {
    var jsonfhir: StorageObject;

    return {
      initialize: (store: StorageObject) => {
        jsonfhir = store;
      },
      jsOnFhir: () => {
        return jsonfhir;
      }
    };
  })();

  private apiMethods = new ApiMethods();
  private storageKey: string;

  /**
   * Creates a new JSOnFhir object and persists it in the sessionStorage so that is
   * still available after a page reload.
   * @param serverUrl                 The URL of the fhir server, e.g. 'https://test.midata.coop'.
   * @param clientId                  The ID of your fhir application as registered with the fhir server.
   * @param redirectUrl               The URL where the callback of the OAuth 2.0 can be directed.
   * @param options?                  Optional parameter. Options object literal.
   * @param options.doesNotNeedAuth?  Optional parameter. Set to true when the FHIR server you're
   *                                  using doesn't require authentication (e.g. when connecting to
   *                                  the EPD playground via MobileAccessGateway). In this case, the
   *                                  parameters clientId and redirectUrl do not matter (but still
   *                                  have to be set.)
   * @param options.disablePkce?      Optional parameter. Set to true if you want to use the OAuth 2.0
   *                                  authorization code flow instead of the recommended and more secure PKCE flow
   *                                  or the server does not support PKCE.
   * @param options.fhirVersion?      Set FHIR version to use. Support of versions can be limited on the server used.
   *                                  Defaults to R4 / 4.0.1.
   *                                  Possibilities: STU3 (3.0.2), R4 (4.0.1), R4B (4.3.0), R5 (5.0.0)
   */
  constructor(
    serverUrl: string,
    clientId: string,
    redirectUrl: string,
    options?: {
      doesNotNeedAuth?: boolean; 
      disablePkce?: boolean; 
      fhirVersion?: FHIR_VERSION;
    }
  ) {
    const storageKey = this.createStorageKey(serverUrl, clientId);
    if (!options) {
      options = {
        doesNotNeedAuth: false,
        disablePkce: false,
        fhirVersion: FHIR_VERSION.R4
      };
    } else if (options) {
      if (typeof options.doesNotNeedAuth === 'undefined') {
        options.doesNotNeedAuth = false;
      }
      if (typeof options.disablePkce === 'undefined') {
        options.disablePkce = false;
      }
    }
    // Check if there is a jsOnFhir object in sessionStorage.
    let persisted = this.getFromStorage(storageKey);

    if (
      !persisted ||
      !(
        persisted.urls.redirect === redirectUrl &&
        persisted.urls.service === serverUrl + '/fhir' &&
        persisted.settings.client === clientId
      )
    ) {
      persisted = DEFAULT_SETTINGS;
      // If no JSOnFhir object could be loaded from sessionStorage, or if it has different parameters
      // we assign the URLs and settings properties and save it to the sessionStorage.
      persisted.urls.service = serverUrl + '/fhir';
      persisted.urls.conformance = serverUrl + '/fhir/metadata';
      persisted.urls.redirect = redirectUrl;
      persisted.settings.client = clientId;
      persisted.settings.scope = 'user/*.*';
      persisted.settings.noAuth = options.doesNotNeedAuth ? options.doesNotNeedAuth : false;
      persisted.settings.noPkce = options.disablePkce ? options.disablePkce : false;
    }

    if (options.fhirVersion) {
      persisted.settings.fhirVersion = options.fhirVersion;
      this.apiMethods.differentiateContentType('application/fhir+json;fhirVersion=' + options.fhirVersion);
    } else {
      persisted.settings.fhirVersion = FHIR_VERSION.R4;
    }

    this.iife.initialize(persisted);
    this.storageKey = storageKey;
    this.persist(storageKey);
  }

  /**
   * This function starts the OAuth 2.0 authentication procedure, by opening the auth
   * page for the client to enter his login credentials. Default OAuth 2.0 PKCE grant type is used.
   * @param params? Optional parameter. An object with key/value pairs.
   *                Can be used to control the login process or may be used
   *                to pre-fill the login or registration form.
   * @returns       nothing
   * @throws        An Error if the conformance statement could not be fetched from the server.
   */
  authenticate(params?: {[key: string]: string}): void {
    if (this.iife.jsOnFhir().settings.noAuth) {
      return;
    }
    // If PKCE isn't disabled, creates a code verifier and code challenge
    // based on the former according to rfc7636 section 4.1.
    if (!this.iife.jsOnFhir().settings.noPkce) {
      this.iife.jsOnFhir().settings.codeVerifier = this.generateCodeVerifier();
      this.iife.jsOnFhir().settings.codeChallenge = this.generateCodeChallenge(
        this.iife.jsOnFhir().settings.codeVerifier
      );
    }
    // Creates an opaque value used by the client to maintain state between the request and callback.
    this.iife.jsOnFhir().settings.state = this.generateState();
    // Fetching of the auth and token URL.
    this.fetchConformanceStatement()
      .then(() => {
        // Build the authorization request according to rfc6749 section 4.1.1.
        let authUrl =
          this.iife.jsOnFhir().urls.auth +
          '?response_type=' +
          this.iife.jsOnFhir().settings.responseType +
          '&client_id=' +
          encodeURIComponent(this.iife.jsOnFhir().settings.client) +
          '&scope=' +
          encodeURIComponent(this.iife.jsOnFhir().settings.scope) +
          '&redirect_uri=' +
          encodeURIComponent(this.iife.jsOnFhir().urls.redirect) +
          '&state=' +
          this.iife.jsOnFhir().settings.state;
        // If PKCE isn't disabled, appends the code challenge to the authorization request according to rfc7636 section 4.3.
        if (!this.iife.jsOnFhir().settings.noPkce) {
          authUrl += '&code_challenge=' + this.iife.jsOnFhir().settings.codeChallenge + '&code_challenge_method=S256';
        }
        // If language exists and is set in settings property, sets the language to be used on the login page.
        if (this.iife.jsOnFhir().settings.language.length === 2) {
          authUrl += '&language=' + encodeURIComponent(this.iife.jsOnFhir().settings.language);
        }
        // Append parameter(s) if they exist.
        if (params) {
          Object.keys(params).forEach((key) => {
            authUrl += '&' + key + '=' + encodeURIComponent(params[key].toString());
          });
        }
        // Go to authorization (login) page to make an authorization request.
        window.location.href = authUrl;
      })
      .catch((error) => {
        throw new Error(error.status + ' ' + error.message);
      });
  }

  /**
   * This function handles the authorization response from the auth server according
   * to rfc6749 section 4.1.2 after the authenticate() function was called. This function must be
   * called from the same page that the redirectUrl (as defined in the constructor) refers to.
   * This function then makes an authorization request to the token endpoint as described in
   * rfc6749 section 4.1.3.
   * @returns A promise when called after authenticate():
   *            - fulfilled:  Response of token endpoint.
   *            - rejected:   An error message.
   */
  handleAuthResponse(): Promise<AuthResponse | null> {
    return new Promise((resolve, reject) => {
      // When the URL has #, window.location.search is empty, and we have to parse windows.location.hash.
      let paramString = window.location.search.length > 0 ? window.location.search : '?' + window.location.hash.split('?')[1];
      // Check whether paramString includes state and authorization code parameters.
      if (paramString.includes('state=') && paramString.includes('code=')) {
        // Create array containing [state=abc,code=xyz]
        const urlParams = paramString.substring(1).split('&');
        // Get state and authorization code from urlParams.
        let state: string, authCode: string;
        urlParams.forEach((entry) => {
          const param = entry.split('=');
          if (param[0] === 'state') {
            state = decodeURIComponent(param[1].replace(/\+/g, '%20'));
          }
          if (param[0] === 'code') {
            authCode = decodeURIComponent(param[1].replace(/\+/g, '%20'));
          }
        });
        // Request an access and refresh token from the token endpoint.
        this.tokenRequest(state, authCode)
          .then((response: AuthResponse) => {
            // Resets the URL so that we don't run into misinterpreting the same code later again.
            history.pushState({}, null, this.iife.jsOnFhir().urls.redirect);
            resolve(response);
          })
          .catch((error) => {
            reject(new Error(error.status + ' ' + error.message));
          });
      } else {
        resolve(null);
      }
    });
  }

  /**
   * Given the prerequisite that the local state and server response state are the same
   * and therefore no cross-site request forgery attack is being performed, this function
   * makes a request to the token endpoint as described in rfc6749 section 4.1.3, or if PKCE isn't disabled
   * as described in rfc7636 section 4.5.
   * The token endpoints response is then handled by the handleTokenResponse() function.
   * @param state     An opaque value used by the client to maintain state between the request and callback.
   * @param authCode  The authorization code received from the authorization server.
   * @returns A promise:
   *            - fulfilled: Response of the token endpoint.
   *            - rejected:  Error message.
   */
  private tokenRequest(state: string, authCode: string): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
      // Check if local state and the server's response state are the same.
      if (this.iife.jsOnFhir().settings.state === state) {
        let data =
          'grant_type=authorization_code' +
          '&redirect_uri=' +
          encodeURIComponent(this.iife.jsOnFhir().urls.redirect) +
          '&client_id=' +
          encodeURIComponent(this.iife.jsOnFhir().settings.client) +
          '&code=' +
          authCode;
        // If PKCE isn't disabled, append the code verifier to the data string.
        if (!this.iife.jsOnFhir().settings.noPkce) {
          data += '&code_verifier=' + this.iife.jsOnFhir().settings.codeVerifier;
        }
        // Make request to the token endpoint using apiCall function from @i4mi/fhir_r4.
        apiCall({
          url: this.iife.jsOnFhir().urls.token,
          method: HttpMethod.POST,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          jsonBody: true,
          payload: data,
          jsonEncoded: false
        }).then((response) => {
          if (response.status === 200) {
            // Handle the response of the token endpoint.
            this.handleTokenResponse(response);
            resolve(response.body);
          } else {
            reject(new Error(response.status + ' ' + response.message));
          }
        });
      } else {
        reject(new Error('Server response state and local state mismatch.'));
      }
    });
  }

  /**
   * Refreshes an access token, given that the client is in possession of a refresh token
   * issued by the authorization server. The token endpoint's response is then handled by
   * the handleTokenResponse() function.
   * @returns A promise:
   *            - fulfilled: Response from token endpoint or empty promise if server doesn't require authentication.
   *            - rejected:  Error message.
   */
  refreshAuth(refreshToken: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Resolve promise if doesNotNeedAuth? was set to true in the constructor.
      if (this.iife.jsOnFhir().settings.noAuth) {
        Promise.resolve();
      }
      // Check that the provided refreshToken is valid.
      if (refreshToken && refreshToken !== '') {
        // Make request to the token endpoint.
        apiCall({
          url: this.iife.jsOnFhir().urls.token,
          method: HttpMethod.POST,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          jsonBody: true,
          payload: 'grant_type=refresh_token&refresh_token=' + this.iife.jsOnFhir().auth.refreshToken,
          jsonEncoded: false
        }).then((response: ApiCallResponse) => {
          if (response.status === 200) {
            // Handle the response of the token endpoint.
            this.handleTokenResponse(response);
            resolve(response.body);
          } else {
            reject(new Error(response.status + ' ' + response.message));
          }
        });
      } else {
        reject(new Error('Invalid refresh token.'));
      }
    });
  }

  /**
   * Checks whether an access token is set and has not yet expired.
   * @returns boolean:
   *            - true:   Access token is valid.
   *            - false:  Access token is invalid. Will also return
   *                      false when doesNotNeedAuth? was set true in the constructor.
   */
  isLoggedIn(): boolean {
    return this.iife.jsOnFhir().auth.accessToken !== '' && this.iife.jsOnFhir().auth.expires > Date.now();
  }

  /**
   * Logs out the user by deleting certain settings and permission properties.
   */
  logout(): void {
    this.iife.jsOnFhir().settings = {
      ...this.iife.jsOnFhir().settings,
      userId: '',
      codeVerifier: '',
      codeChallenge: '',
      state: ''
    };
    this.iife.jsOnFhir().auth = {
      accessToken: '',
      expires: 0,
      type: '',
      refreshToken: ''
    };
    this.persist(this.storageKey);
  }

  /**
   * Helper function to get a ApiConfig object consisting of the access token, authorization type and the base URL.
   * @returns ApiConfig object.
   */
  private getApiConfig(): ApiConfig {
    return {
      access_token: this.iife.jsOnFhir().auth.accessToken,
      authorization_type: this.iife.jsOnFhir().auth.type,
      base_url: this.iife.jsOnFhir().urls.service
    };
  }

  /**
   * Creates a resource on the fhir server.
   * @param resource Resource to be saved.
   * @returns A promise:
   *            - fulfilled:  Representation of fhir resource in JSON format.
   *            - rejected:   Error message.
   */
  create(resource: Resource | string): Promise<Resource> {
    return new Promise((resolve, reject) => {
      // Reject promise if user is not logged in and doesNotNeedAuth? was set to false in the constructor.
      if (!(this.isLoggedIn() || this.iife.jsOnFhir().settings.noAuth)) {
        reject(new Error('User not logged in.'));
      }
      // Create a resource on the fhir server by calling the create() function of apiMethods.
      this.apiMethods
        .create(resource, this.getApiConfig())
        .then((response) => {
          response.status === 200 || response.status === 201
            ? resolve(JSON.parse(response.body) as Resource)
            : reject(response);
        })
        .catch((error) => {
          this.handleError(error);
          reject(new Error(error.status + ' ' + error.message));
        });
    });
  }

  /**
   * Updates a resource on the fhir server.
   * @param resource Resource to be updated.
   * @returns A promise:
   *            - fulfilled:  Representation of fhir resource in JSON format.
   *            - rejected:   Error message.
   */
  update(resource: Resource): Promise<Resource> {
    return new Promise((resolve, reject) => {
      // Reject promise if user is not logged in and doesNotNeedAuth? was set to false in the constructor.
      if (!(this.isLoggedIn() || this.iife.jsOnFhir().settings.noAuth)) {
        reject(new Error('User not logged in.'));
      }
      // Reject promise if resource ID is undefined.
      if (typeof resource.id === 'undefined' && typeof resource._id === 'undefined') {
        reject(new Error('Resource has no id.'));
      }
      // Update resource on the fhir server by calling the update() function of apiMethods.
      this.apiMethods
        .update(resource, this.getApiConfig())
        .then((response) => {
          response.status === 200 || response.status === 201
            ? resolve(JSON.parse(response.body) as Resource)
            : reject(response);
        })
        .catch((error) => {
          this.handleError(error);
          reject(new Error(error.status + ' ' + error.message));
        });
    });
  }

  /**
   * Searches for resources matching the given criteria in params.
   * @param resourceType  ResourceType to be searched.
   * @param params?       Optional parameter. Search parameters according to fhir resource guide.
   * @returns A promise:
   *            - fulfilled:  Bundle of type searchset containing the fhir resource(s).
   *            - rejected:   Error message.
   */
  search(resourceType: string, params?: {[key: string]: string}): Promise<Bundle> {
    if (this.iife.jsOnFhir().settings.supportedResourceTypes.findIndex((r) => r === resourceType) === -1) {
      return Promise.reject(
        'ResourceType "' +
          resourceType +
          '" is not supported by this server.' +
          (resourceType.includes('/') ? ' For directly fetching a resource use getResource().' : '')
      );
    }
    return new Promise((resolve, reject) => {
      // Reject promise if user is not logged in and doesNotNeedAuth? was set to false in the constructor.
      if (!(this.isLoggedIn() || this.iife.jsOnFhir().settings.noAuth)) {
        reject(new Error('User not logged in.'));
      }
      // Search for one specific or multiple resources on the fhir server by calling the search() function of apiMethods.
      this.apiMethods
        .search(params, resourceType, this.getApiConfig())
        .then((response) => {
          response.status === 200 || response.status === 201
            ? resolve(JSON.parse(response.body) as Bundle)
            : reject(response);
        })
        .catch((error) => {
          this.handleError(error);
          reject(new Error(error.status + ' ' + error.message));
        });
    });
  }

  /**
   * Fetches a given known resource.
   * @param resourceType  ResourceType of the resource.
   * @param id            The unique id of the resource.
   * @returns A promise:
   *            - fulfilled:  Bundle of type searchset containing the fhir resource(s).
   *            - rejected:   Error message.
   */
  getResource(resourceType: string, id: string): Promise<Resource> {
    return new Promise((resolve, reject) => {
      // Reject promise if user is not logged in and doesNotNeedAuth? was set to false in the constructor.
      if (!(this.isLoggedIn() || this.iife.jsOnFhir().settings.noAuth)) {
        reject(new Error('User not logged in.'));
      }
      // Search for one specific or multiple resources on the fhir server by calling the search() function of apiMethods.
      this.apiMethods
        .search(null, resourceType + '/' + id, this.getApiConfig())
        .then((response) => {
          response.status === 200 || response.status === 201
            ? resolve(JSON.parse(response.body) as Resource)
            : reject(response);
        })
        .catch((error) => {
          this.handleError(error);
          reject(new Error(error.status + ' ' + error.message));
        });
    });
  }

  /**
   * Performs a given operation on the fhir server.
   * @param operation       The type of the operation (e.g 'process-message').
   * @param payload?        Optional Parameter. A resource or other payload to process in the operation.
   * @param httpMethod      Optional Parameter. The HTTP method to be used (GET|POST|PUT|DELETE). Default is HTTP method (POST).
   * @param params?         Optional Parameter. Parameters, either as key/value pair or as a string.
   * @param resourceType?   Optional Parameter. Specify the resource type on which the operation is to be performed (mandatory if resourceId is used).
   * @param resourceId?     Optional Parameter. Specify an instance of a resource for which the operation is to be performed.
   * @returns A promise:
   *            - fulfilled:  Response of the fhir server.
   *            - rejected:   Error message.
   */
  performOperation(
    operation: string,
    payload?: Resource | string,
    httpMethod: HttpMethod = HttpMethod.POST,
    params?: {[key: string]: string},
    resourceType?: string,
    resourceId?: string
  ): Promise<Resource> {
    return new Promise((resolve, reject) => {
      // Reject promise if user is not logged in and doesNotNeedAuth? was set to false in the constructor.
      if (!(this.isLoggedIn() || this.iife.jsOnFhir().settings.noAuth)) {
        reject(new Error('User not logged in.'));
      }
      // Reject promise if resourceInstance (resourceId) but no resourceType is provided.
      if (resourceId && !resourceType) {
        reject(new Error('Instance of resource is provided, but not the resourceType.'));
      }
      // Create paramUrl.
      let paramUrl = '';
      // Append parameters from key/value pairs or from a string.
      if (params) {
        paramUrl += '?';
        if (typeof params === 'string') {
          paramUrl += encodeURI(params);
        } else {
          Object.keys(params).forEach((key, index) => {
            paramUrl += index === 0 ? key + '=' + encodeURI(params[key]) : '&' + (key + '=' + encodeURI(params[key]));
          });
        }
      }
      // Set '/' prefix to resourceType and resourceId if they exist. If they don't exist, set them both to ''.
      resourceType = resourceType ? '/' + resourceType : '';
      resourceId = resourceId ? '/' + resourceId : '';
      // Perform operation on fhir server by using apiCall function from @i4mi/fhir_r4.
      apiCall({
        url: this.iife.jsOnFhir().urls.service + resourceType + resourceId + '/$' + operation + paramUrl,
        method: httpMethod,
        headers: {
          'Content-Type':
            'application/fhir+json;' +
            (this.iife.jsOnFhir().settings.fhirVersion && this.iife.jsOnFhir().settings.fhirVersion.length > 0
              ? ' fhirVersion=' + this.iife.jsOnFhir().settings.fhirVersion
              : ''),
          Authorization: 'Bearer ' + this.getAccessToken()
        },
        jsonBody: true,
        payload: payload,
        jsonEncoded: typeof payload !== 'string'
      })
        .then((response) => {
          resolve(typeof response === 'string' ? JSON.parse(response).body : response.body);
        })
        .catch((error) => {
          reject(new Error(error.status + ' ' + error.message));
        });
    });
  }

  /**
   * Sets the language for the authorization request window.
   * @param lang The language as two-char string (eg. 'de', 'en', 'fr' or 'it').
   */
  setLanguage(lang: string): void {
    if (lang.length === 2) {
      this.iife.jsOnFhir().settings.language = lang.toLowerCase();
      this.persist(this.storageKey);
    } else {
      throw new Error('The supplied language code is not a two-char string.');
    }
  }

  /**
   * Sets the conformance URL, if it differs from the default (serverURL + '/fhir/metadata').
   * @param conformanceUrl The new conformance statement URL.
   */
  setConformanceUrl(conformanceUrl: string): void {
    this.iife.jsOnFhir().urls.conformance = conformanceUrl;
    this.persist(this.storageKey);
  }

  /**
   * Sets the scope when it differs from the default 'user/*.*'.
   * @param scope The scope as string.
   */
  setScope(scope: string): void {
    this.iife.jsOnFhir().settings.scope = scope;
    this.persist(this.storageKey);
  }

  /**
   * Returns the resource id of the Patient or Practitioner resource of the logged in user
   * @return       the Patient Resource ID as a string, if logged in
   * @return       undefined if not logged in
   * @deprecated   use getUserId() instead
   */
  getPatient() {
    console.warn(
      'js-on-fhir: getPatient() is deprecated since V1.0.0 and will be removed in a later versions.\nUse getUserId() instead.'
    );
    return this.getUserId();
  }

  /**
   * Returns the resource id of the of the logged in user. With this id, you can then fetch the
   * Patient (for normal user) or Practitioner (for health professionals or researcher).
   * @return       the Patient Resource ID as a string, if logged in
   *               undefined if not logged in
   */
  getUserId() {
    if (this.iife.jsOnFhir().settings.userId && this.iife.jsOnFhir().settings.userId !== '') {
      return this.iife.jsOnFhir().settings.userId;
    } else {
      return undefined;
    }
  }

  /**
   * Creates an opaque value used by the client to maintain state
   * between the request and callback. Is used for preventing
   * cross-site request forgery according to rfc 6749 section 4.1.1.
   * @returns state (url-safe) with a length of 128 characters.
   */
  generateState(): string {
    return encodeURIComponent(forge.util.encode64(forge.random.getBytesSync(128)))
      .replace(/%/g, '')
      .substring(0, 128);
  }

  /**
   * Generates a code verifier according to rfc7636 section 4.1.
   * The code verifier is a high-entropy cryptographic URL safe random string
   * using the unreserved characters from rfc3986 section 2.3,
   * with a minimum length of 43 characters and a maximum length of 128 characters.
   * @returns code verifier (url-safe) with a length of 128 characters.
   */
  private generateCodeVerifier(): string {
    return encodeURIComponent(forge.util.encode64(forge.random.getBytesSync(128)))
      .replace(/%/g, '')
      .substring(0, 128);
  }

  /**
   * Creates a code challenge derived from the code verifier according to rfc 7636 section 4.2.
   * The code transformation used on the code verifier is SHA256. The result is then Base64 encoded.
   * @param codeVerifier high-entropy cryptographic URL safe random string using the unreserved characters from rfc3986 section 2.3.
   * @returns code challenge (hashed and Base64 encoded code verifier).
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return forge.util
      .encode64(
        forge.util.hexToBytes(forge.md.sha256.create().update(forge.util.decodeUtf8(codeVerifier)).digest().toHex())
      )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Fetches the auth and token URL as well as the supported fhir version from the conformance statement endpoint (default=/fhir/metadata).
   * Also fetches the fhir version supported by the server.
   * @returns A promise:
   *            - fulfilled: Response of the conformance statement request.
   *            - rejected:  Error message.
   */
  private fetchConformanceStatement(): Promise<ApiCallResponse> {
    return new Promise((resolve, reject) => {
      // Set the conformance endpoint URL.
      const cfUrl =
        typeof this.iife.jsOnFhir().urls.conformance !== 'undefined'
          ? this.iife.jsOnFhir().urls.conformance
          : this.iife.jsOnFhir().urls.service + '/metadata';
      // Make request to the conformance endpoint using apiCall function from @i4mi/fhir_r4.
      apiCall({
        url: cfUrl,
        headers: {
          'Content-Type':
            'application/fhir+json;' +
            (this.iife.jsOnFhir().settings.fhirVersion && this.iife.jsOnFhir().settings.fhirVersion.length > 0
              ? ' fhirVersion=' + this.iife.jsOnFhir().settings.fhirVersion
              : '')
        },
        method: HttpMethod.GET
      })
        .then((response) => {
          if (response.status === 200) {
            // Handle the response of the conformance statement request.
            this.handleConformanceStatementResponse(response);
            resolve(response);
          } else {
            reject(new Error(response.status + ' ' + response.message));
          }
        })
        .catch((error) => {
          reject(new Error(error.status + ' ' + error.message));
        });
    });
  }

  /**
   * Getter Function that returns the current access token, if available.
   * @returns access Token
   */
  getAccessToken(): string {
    return this.iife.jsOnFhir().auth && this.iife.jsOnFhir().auth.accessToken
      ? this.iife.jsOnFhir().auth.accessToken
      : undefined;
  }

  /**
   * Changes the FHIR version used to do the requests to the server.
   * Note that the available versions may be restricted on your server.
   * @param version The FHIR version to use. Support of versions can be restricted on the server used.
   *                Supported versions: STU3 (3.0.2), R4 (4.0.1), R4B (4.3.0), R5 (5.0.0)
   */
  changeFhirVersion(version: FHIR_VERSION): void {
    this.iife.jsOnFhir().settings.fhirVersion = version;
    this.apiMethods.differentiateContentType('application/fhir+json;fhirVersion=' + version);
  }

  /**
   * Handles the response of the conformance statement request by saving the relevant data.
   * @param response Response of the conformance Request.
   */
  private handleConformanceStatementResponse(response: ApiCallResponse): void {
    response.body = JSON.parse(response.body);
    this.iife.jsOnFhir().urls.token = response.body.rest['0'].security.extension['0'].extension['0'].valueUri;
    this.iife.jsOnFhir().urls.auth = response.body.rest['0'].security.extension['0'].extension['1'].valueUri;
    this.iife.jsOnFhir().settings.supportedResourceTypes = response.body.rest['0'].resource.map((r) => r.type);
    this.iife.jsOnFhir().settings.fhirVersion = response.body.fhirVersion;
    this.persist(this.storageKey);
  }

  /**
   * Handles the token endpoint response by saving the relevant data from the access token request.
   * @param response Response of the access token request.
   */
  private handleTokenResponse(response: ApiCallResponse) {
    this.iife.jsOnFhir().auth.accessToken = response.body.access_token;
    this.iife.jsOnFhir().auth.expires = Date.now() + 1000 * response.body.expires_in;
    this.iife.jsOnFhir().auth.type = response.body.token_type;
    this.iife.jsOnFhir().auth.refreshToken = response.body.refresh_token;
    this.iife.jsOnFhir().settings.userId = response.body.patient;
    this.persist(this.storageKey);
  }

  /**
   * Helper function for creating a storage key that is unique for a server / client combination.
   */
  private createStorageKey(serverUrl: string, clientId: string): string {
    return forge.util.encode64(forge.util.decodeUtf8(encodeURIComponent(serverUrl + clientId)));
  }

  /**
   * Helper function that saves the JSOnFhir object to sessionStorage. It is used to restore
   * the JSOnFhir object after a page reload (e.g. after the authenticate() function was called).
   */
  private persist(key: string): void {
    if (!key) throw new Error('Can not persist without key');
    const toStore: StorageObject = this.iife.jsOnFhir();
    sessionStorage.setItem(key, JSON.stringify(toStore));
  }

  private getFromStorage(key: string): StorageObject | null {
    const fromStorage = sessionStorage.getItem(key);
    return fromStorage
      ? JSON.parse(fromStorage) as StorageObject
      : null;
  }

  /**
   * Helper function to handle errors (e.g. expired access token).
   * @param error Error object.
   */
  private handleError(error: {body: string; status: number}) {
    if (error.body === 'Invalid token' || error.body === 'Expired token' || error.status === 401) {
      this.logout();
    }
  }
}
