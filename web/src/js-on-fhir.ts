import { apiCall, HttpMethod, ApiCallResponse } from '@i4mi/fhir_r4';
import { AuthRequest, AuthResponse, TokenExchangeRequest } from './typeDefinitions';

export class JSOnFhir {
  private urls = {
    service: '',
    conformance: '', // TODO: needs setter
    auth: '',
    redirect: '', // TODO: needs setter
    token: ''
  }
  private settings = {
    client: '',
    patient: '',
    scope: '',
    state: '',
    language: 'de',       // TODO: needs setter
    responseType: 'code'
  }
  private access = {
    token: '',
    expires: 0,
    type: '',
    refreshToken: ''
  };


  /**
  * Creates a new jsOnFhir object and persists it in the sessionStorage, so it is
  * still available after a page relaunch
  * @param serverUrl    the url of the fhir server, e.g. 'https://test.midata.coop'
  * @param clientId     the id of your fhir application
  * @param redirectUrl  the url where the callback of the oAuth2.0 can be directed
  */
  constructor(serverUrl: string, clientId: string, redirectUrl: string){
    // check if we have a jsOnFhir object in sessionStorage
    let persisted = JSON.parse(sessionStorage.getItem('jsOnFhir'));
    if(persisted != null){
      if(persisted.urls.redirect === redirectUrl && persisted.urls.service === serverUrl + '/fhir' && persisted.settings.client === clientId){
        console.log("jsOnFhir(): restore from sessionStorage");
        // assign prototype to the object loaded from storage, so it becomes
        // a full JSOnFhir object with functions
        persisted.__proto__ = JSOnFhir.prototype;
        return persisted;
      }
    }
    // if no jsOnFhir object could be loaded, or if it has different parameters
    // we do the actual constructor stuff (and save it to the sessionStorage)
    console.log("jsOnFhir(): everything new");
    this.urls.service = serverUrl + '/fhir';
    this.urls.conformance = serverUrl + '/fhir/metadata';
    this.urls.redirect = redirectUrl;
    this.settings.client = clientId;
    this.settings.scope = 'user/*.*';
    this.persistMe();
  }


  /**
  * This function starts the oAuth authentication procedure, by opening the auth
  * page for the user to login to the fhir server.
  */
  authenticate(){
    this.fetchConformanceStatement()
    .then(res => {
      // generate state
      this.generateRandomState(64);

      // generate auth url
      let authUrl = this.urls.auth + '?' +
      'response_type=' + this.settings.responseType + '&' +
      "client_id=" + encodeURIComponent(this.settings.client) + "&" +
      "scope=" + encodeURIComponent(this.settings.scope) + "&" +
      "redirect_uri=" + encodeURIComponent(this.urls.redirect) + "&" +
      "aud=" + encodeURIComponent(this.urls.service) + "&" +
      "state=" + this.settings.state + "&language=" + this.settings.language;

      window.location.href = authUrl;
    })
    .catch(err => {
      console.warn("error fetching auth statement", err);
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
      if(window.location.search.includes('state=') && window.location.search.includes('code=')){
        var urlParams = window.location.search.substring(1).split('&');
        var state, code: string;
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
          }).then((response: ApiCallResponse) => {
            if(response.status === 200){
              this.access.token = response.body.access_token;
              this.access.expires = Date.now() + response.body.expires_in - 10000;
              this.access.type = response.body.token_type;
              this.settings.patient = response.body.patient;
              this.access.refreshToken = response.body.refresh_token;
              this.persistMe();

              // reset the url so we don't run into misinterpreting the same code later again
              window.location.search = '';
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
  * Makes api call to get the auth and token url
  * from the fhir/midatata of the server.
  * Returns a json response with a resource in the .body
  * Rejects the original error if one occures
  */
  private fetchConformanceStatement(): Promise<any> {
    return new Promise((resolve, reject) => {
      const cfUrl = (typeof this.urls.conformance !== 'undefined') ? this.urls.conformance : this.urls.service + '/metadata';

      apiCall({
        url: cfUrl,
        method: HttpMethod.GET
      }).then((response: ApiCallResponse) => {
        return this.interpretConformanceStatementResponse(response);
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
  private interpretConformanceStatementResponse(response: ApiCallResponse): Promise<any> {
    return new Promise((resolve, reject) => {
      if (response.status === 200) {
        // override body with parsed response
        // todo --> try to map oject from lib
        response.body = JSON.parse(response.body);
        this.urls.token = response.body.rest['0'].security.extension['0'].extension['0'].valueUri;
        this.urls.auth = response.body.rest['0'].security.extension['0'].extension['1'].valueUri;
        this.persistMe();
        resolve(response);
      } else {
        reject(response);
      }
    });
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
    this.settings.state = '';
    for (let i = 0; i < length; i++) {
      this.settings.state += possibilities.charAt(Math.floor(Math.random() * possibilities.length));
    }
    this.persistMe();
  }


  /**
  * helper function that saves the whole object to sessionStorage,
  * so it can be restored after a page reload (e.g. after authenticate())
  */
  private persistMe(){
    sessionStorage.setItem('jsOnFhir', JSON.stringify(this));
  }

}
