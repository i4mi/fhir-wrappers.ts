import { apiCall, HttpMethod, ApiMethods } from '@i4mi/fhir_r4';

export class JSOnFhir {
  private apiMethods = new ApiMethods();
  private urls = {
    service: '',
    conformance: '',
    auth: '',
    redirect: '',
    token: ''
  }
  private settings = {
    client: '',
    patient: '',
    scope: '',
    state: '',
    language: '',
    fhirVersion: '',
    responseType: 'code',
    noAuth: false
  }
  private auth = {
    token: '',
    expires: 0,
    type: '',
    refreshToken: ''
  };


  /**
  * Creates a new jsOnFhir object and persists it in the sessionStorage, so it is
  * still available after a page relaunch
  * @param serverUrl        the url of the fhir server, e.g. 'https://test.midata.coop'
  * @param clientId         the id of your fhir application
  * @param redirectUrl      the url where the callback of the oAuth2.0 can be directed
  * @param doesNotNeedAuth? optional parameter. Set to true when the FHIR server you're
  *                         using doesn't require authentification (eg. when connecting to
  *                         the EPD playground via MobileAccessGateway). In this case, the
  *                         parameters clientId and redirectUrl do not matter (but still
  *                         have to be set.)
  */
  constructor(serverUrl: string, clientId: string, redirectUrl: string, doesNotNeedAuth?: boolean){
    // check if we have a jsOnFhir object in sessionStorage
    let persisted = JSON.parse(sessionStorage.getItem('jsOnFhir'));
    if(persisted != null){
      if(persisted.urls.redirect === redirectUrl && persisted.urls.service === serverUrl + '/fhir' && persisted.settings.client === clientId){
        // assign prototype to the object loaded from storage, so it becomes
        // a full JSOnFhir object with functions
        persisted.__proto__ = JSOnFhir.prototype;
        persisted.apiMethods = new ApiMethods();
        return persisted;
      }
    }
    // if no jsOnFhir object could be loaded, or if it has different parameters
    // we do the actual constructor stuff (and save it to the sessionStorage)
    this.urls.service = serverUrl + '/fhir';
    this.urls.conformance = serverUrl + '/fhir/metadata';
    this.urls.redirect = redirectUrl;
    this.settings.client = clientId;
    this.settings.scope = 'user/*.*';
    this.settings.noAuth = doesNotNeedAuth ? doesNotNeedAuth : false;
    this.persistMe();
  }


  /**
  * This function starts the oAuth authentication procedure, by opening the auth
  * page for the user to login to the fhir server.
  * @param params (optional) an Object with key / value pairs
  */
  authenticate(params?: Object){
    if (this.settings.noAuth) return;
    this.fetchConformanceStatement()
    .then(res => {
      // generate auth url
      let authUrl = this.urls.auth + '?' +
      'response_type=' + this.settings.responseType + '&' +
      "client_id=" + encodeURIComponent(this.settings.client) + "&" +
      "scope=" + encodeURIComponent(this.settings.scope) + "&" +
      "redirect_uri=" + encodeURIComponent(this.urls.redirect) + "&" +
      "aud=" + encodeURIComponent(this.urls.service) + "&" +
      "state=" + this.generateRandomState(64);

      if(this.settings.language.length > 0){
        authUrl += '&language=' + this.settings.language;
      }

      if(params) {
          Object.keys(params).forEach((key) => {
              authUrl = authUrl + '&' + key + '=' + params[key].toString();
          });
      }

      window.location.href = authUrl;
    })
    .catch(err => {
      console.warn("error fetching auth statement", err);
      throw(err);
    })
  }


  /**
  * This function handles the response from the authentification server, after the
  * authenticate() function was called. This function has to be called from the
  * page that the redirectUrl (as defined in the constructor) refers to.
  *
  * @return when called after authenticate(): a Promise
  *           - successful:     the response of the server (with token, refresh-token etc.)
  *           - not sucessful:  an error message
  *         when not called after authenticate(): a Promise resolved to NULL
  */
  handleAuthResponse(){
    return new Promise((resolve, reject) => {
        // when the url has #, window.location.search is empty and we have to parse windows.location.hash
        const paramString = window.location.search.length > 0
                               ? window.location.search
                               : '?' + window.location.hash.split('?')[1];
        if(paramString.includes('state=') && paramString.includes('code=')){
          var urlParams = paramString.substring(1).split('&');
        var state: string, code: string;
        for (var i = 0; i < urlParams.length; i++)
        {
          var param = urlParams[i].split('=');
          if (param[0] == "state") {
            state = decodeURIComponent(param[1].replace(/\+/g, '%20'));
          }
          if (param[0] == "code") {
            code = decodeURIComponent(param[1].replace(/\+/g, '%20'));
          }
        }
        if(this.settings.state === state){

          let data = 'grant_type=' + 'authorization_code'
          + '&redirect_uri=' + encodeURIComponent(this.urls.redirect)
          + '&client_id=' + encodeURIComponent(this.settings.client)
          + '&code=' + code;

          apiCall({
            url: this.urls.token,
            method: HttpMethod.POST,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            jsonBody: true,
            payload: data,
            jsonEncoded: false
          }).then((response) => {
            if(response.status === 200){
              this.interpretAuthResponse(response)

              // reset the url so we don't run into misinterpreting the same code later again
              history.pushState({}, null, this.urls.redirect);

              resolve(response.body);
            }
            else {
              reject("faulty http status: " + response.status + ": " + response.message);
            }
          }).catch((error) => {
            reject(error);
          });
        }
        else{
          reject("server response state differs from local state");
        }
      }
      else{
        resolve(null);
      }
    });
  }


  /**
  * Fetches a new token from the oAuth server, using a given refreshToken, and
  * saves the new auth information
  * @param refreshToken the refreshToken, as received from the response of
  *                     handleAuthResponse()
  * @returns a promise with, when:
  *           - successful:     the response of the server (with token, new refresh-token etc.)
  *           - not sucessful:  an error message
  *           - doesNotNeedAuth set in constructor:
  *                             an empty promise
  */
  refreshAuth(refreshToken: String){
    if (this.settings.noAuth) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {

      if(refreshToken === '' || !refreshToken){
        reject("Invalid refresh token");
      }

      apiCall({
        url: this.urls.token,
        method: HttpMethod.POST,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        jsonBody: true,
        payload: 'grant_type=refresh_token&refresh_token=' + refreshToken,
        jsonEncoded: false
      }).then(response => {
        if(response.status === 200){
          this.interpretAuthResponse(response)
          resolve(response.body);
        }
        else {
          reject("faulty http status: " + response.status + ": " + response.message);
        }
      }).catch(err => {
        console.log('fehler:', err)
        reject(err);
      });
    });
  }

  /**
  * Checks if a token is set and not expired. Will also return false when doesNotNeedAuth
  * was set to true in the constructor.
  * @returns boolean (true if non-expired token set)
  */
  isLoggedIn(){
    return (this.auth.token != '' && this.auth.expires > Date.now());
  }


  /**
  * Logs out the user by deleting the authentification information
  */
  logout() {
    this.settings.patient = '',
    this.auth = {
      token: '',
      expires: 0,
      type: '',
      refreshToken: ''
    };
    this.persistMe();
  }


  /**
  * Creates a resource on the fhir server
  * @param resource resource to save
  * @returns resolve of resource as JSON if status 200 or 201
  * @returns reject every other case with message
  */
  create(resource){
    return new Promise((resolve, reject) => {
      if(!(this.isLoggedIn() || this.settings.noAuth)){
        reject('Not logged in');
      }

      const config = {
        access_token: this.auth.token,
        authorization_type: this.auth.type,
        base_url: this.urls.service
      }

      // call create of apimethods
      this.apiMethods.create(resource, config).then((response) => {
        if (response.status === 200 || response.status === 201)
        resolve(JSON.parse(response.body));
        else
        reject(response);
      }).catch((error) => {
        this.handleError(error);
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
  update(resource){
    return new Promise((resolve, reject) => {
      // checks if resource has id
      if (typeof resource.id === 'undefined' &&
      typeof resource._id === 'undefined') {
        reject('Resource has no id');
      }

      if (!(this.isLoggedIn()  || this.settings.noAuth)) {
        reject('Not logged in');
      }

      const config = {
        access_token: this.auth.token,
        authorization_type: this.auth.type,
        base_url: this.urls.service
      }

      // calls update of apimethods
      this.apiMethods.update(resource, config).then((response) => {
        if (response.status === 200 || response.status === 201)
        resolve(JSON.parse(response.body));
        else
        reject(response);
      }).catch((error) => {
        this.handleError(error);
        reject(error);
      });
    });
  }


  /**
  * Searches for one or multiple resources
  * @param resourceType resource type to look up
  * @param params search parameters according fhir resource guide (not mandatory)
  * @returns resolve of resource as JSON if status 200 or 201
  * @returns reject every other case with message
  */
  search(resourceType, params?){
    return new Promise((resolve, reject) => {
      // checks if logged in and has auth token
      if (!(this.isLoggedIn()  || this.settings.noAuth)) {
        reject('Not logged in');
      }

      const config = {
        access_token: this.auth.token,
        authorization_type: this.auth.type,
        base_url: this.urls.service
      }

      this.apiMethods.search(params, resourceType, config).then((response) => {
        if (response.status === 200 || response.status === 201){
          resolve(JSON.parse(response.body));
        }
        else{
          reject(response);
        }
      }).catch((error) => {
        this.handleError(error);
        reject(error);
      });
    });
  }

  /**
  * Processes a message on the fhir server
  * @param message A Bundle with all the properties of a message
  * @returns the response of the server if successful
  * @returns reject every other case with message
  * @deprecated use processOperation instead
  */
  processMessage(message) {
      if (message.resourceType !== 'Bundle' || message.type !== 'message') {
          throw new Error('invalid parameter: resource is not a Bundle or not of type message.');
      }
      if (!message.entry.find(entry => entry.resource.resourceType === 'MessageHeader')) {
          throw new Error('invalid parameter: message contains no MessageHeader resource');
      }
      return this.performOperation('process-message', message);
  }


  /**
  * Performs a given operation on the server.
  * @param operation the type of the operation, for example process-message
  * @param payload a Resource or other payload to process in the operation (optional)
  * @param httpMethod the HTTP method to use (GET|POST|PUT|DELETE) (optional)
  * @param params parameters, either as key/value pair or as a string (optional)
  * @param resourceType specify the type of Resources the operation should be performed on (optional, mandatory when using resourceId)
  * @param resourceId specify an instance of a Resource the operation should be performed on (optional)
  * @returns the response of the server if successful
  * @returns reject every other case with message
  */
  performOperation(operation: string, payload?: any, httpMethod: HttpMethod = HttpMethod.POST, params?: any, resourceType?: string, resourceId?: string) {
    if (resourceId && !resourceType) {
        throw new Error('invalid parameters: resourceInstance provided, but no resourceType')
    }
    let paramUrl = ''
    if (params) {
        paramUrl += '?';
        if (typeof params === 'string') {
            paramUrl += encodeURI(params);
        }
        else {
            Object.keys(params).forEach((key, index) => {
                paramUrl += (index === 0)
                    ? (key + "=" + encodeURI(params[key]))
                    : '&' + (key + "=" + encodeURI(params[key]));
            });
        }
    }
    resourceType = resourceType
                            ? '/' + resourceType
                            : '';
        resourceId = resourceId
                            ? '/' + resourceId
                            : '';
    return new Promise((resolve, reject) => {
      apiCall({
        url: this.urls.service + resourceType + resourceId + '/$' + operation + paramUrl,
        method: httpMethod,
        headers: {
          'Content-Type': 'application/fhir+json; fhirVersion=4.0'
        },
        jsonBody: true,
        payload: payload,
        jsonEncoded: typeof payload != 'string'
      })
      .then((response) => {
          resolve(response);
      })
      .catch(error => {
        reject(error);
      });
    });
  }



  /**
  * Sets the language for the auth window
  * @param lang the language as two-char string (eg. 'de', 'en', 'fr' or 'it')
  * @throws error if the given language string is not
  */
  setLanguage(lang: string){
    if(lang.length === 2){
      this.settings.language = lang.toLowerCase();
      this.persistMe();
    }
    else {
      throw('wrong parameter: language code is not a two-char string');
    }

  }


  /**
  * Sets the conformance url, in cases when it differentiates from the default /metadata
  * @param conformanceUrl the new url
  */
  setConformanceUrl(conformanceUrl: string){
    this.urls.conformance = conformanceUrl;
    this.persistMe();
  }


  /**
  * Sets the scope, for when it differs from the default 'user/*.*'
  * @param scope the scope as string
  */
  setScope(scope: string){
    this.settings.scope = '';
    this.persistMe();
  }

  /**
  * Returns the resource id of the Patient resource of the logged in user
  * @return the Patient Resource ID as a string, if logged in
  * @return undefined if not logged in
  */
  getPatient() {
    if(this.settings.patient && this.settings.patient != ''){
      return this.settings.patient;
    } else {
      return undefined;
    }
  }

  /**
  * Generates random state string with given length
  * If length is set to 0, it will take 122
  * @param length length of the string to generate
  * @return the generated state
  */
   generateRandomState(length: number) {
    if (length <= 0) {
      length = 122;
    }
    const possibilities = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    this.settings.state = '';
    for (let i = 0; i < length; i++) {
      this.settings.state += possibilities.charAt(Math.floor(Math.random() * possibilities.length));
    }
    this.persistMe();
    return this.settings.state;
  }

  /**
  * Makes api call to get the auth and token url
  * from the fhir/midatata of the server.
  * Returns a json response with a resource in the .body
  * Rejects the original error if one occures
  */
  fetchConformanceStatement(): Promise<any> {
    return new Promise((resolve, reject) => {
      const cfUrl = (typeof this.urls.conformance !== 'undefined') ? this.urls.conformance : this.urls.service + '/metadata';

      apiCall({
        url: cfUrl,
        method: HttpMethod.GET
      }).then((response) => {
        return this.interpretConformanceStatementResponse(response);
      }).then((resource) => {
        resolve(resource);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  /**
  * Returns the current access token, if available.
  */
  getAccessToken(): string {
      return (this.auth && this.auth.token)
                    ? this.auth.token
                    : undefined;
  }


  /**
  * function that interprets the result of the api request
  */
  private interpretConformanceStatementResponse(response): void {
      if (response.status === 200) {
        response.body = JSON.parse(response.body);
        this.urls.token = response.body.rest['0'].security.extension['0'].extension['0'].valueUri;
        this.urls.auth = response.body.rest['0'].security.extension['0'].extension['1'].valueUri;
        this.settings.fhirVersion = response.body.fhirVersion;
        this.persistMe();
      } else {
        throw new Error('Wrong response status (' + response.status + ')');
      }
  }

  /**
  ** Helper function for saving the relevant data from an auth request
  * @param response the response object from a auth or authrefresh request
  */
  private interpretAuthResponse(response){
    this.auth.token = response.body.access_token;
    this.auth.expires = Date.now() + 1000 * response.body.expires_in;
    this.auth.type = response.body.token_type;
    this.auth.refreshToken = response.body.refresh_token;
    this.settings.patient = response.body.patient;

    this.persistMe();
  }

  /**
  * helper function that saves the whole object to sessionStorage,
  * so it can be restored after a page reload (e.g. after authenticate())
  */
  private persistMe(){
    sessionStorage.setItem('jsOnFhir', JSON.stringify(this));
  }

  /**
  * Helper function for reacting to errors, like for example expired token.
  */
  private handleError(error) {
      if (error.body === 'Invalid token'
        || error.body === 'Expired token'
        || error.status === 401) {
        this.logout();
      }
  }
}
