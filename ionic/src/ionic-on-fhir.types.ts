import { HttpParams } from '@angular/common/http';

/** ACCORDING http://www.hl7.org/fhir/smart-app-launch/index.html */
/**
 * The url parameters of the oauth request
 * according SMART on FHIR
 */
export interface AuthRequest {
    auth_url: string; // The url where to authenticate. In most cases you get it from the [YOUR_URL]/metadata request
    response_type: 'code'; // Fixed value: code.
    client_id: string; // The client's identifier.
    redirect_uri: string; // Must match one of the client's pre-registered redirect URIs.
    launch?: string; // When using the EHR launchflow, this must match the launch value received from the EHR.
    scope: string; // Must describe the access that the app needs, including clinical data scopes like patient/*.read,
    // openid and fhirUser (if app needs authenticated patient identity) and either:
    // a launch value indicating that the app wants to receive already-established launch context details from the EHR
    // a set of launch context requirements in the form launch/patient,
    // which asks the EHR to establish context on your behalf.
    state: string; // An opaque value used by the client to maintain state between the request and callback.
    // The authorization server includes this value when redirecting the user-agent back to the client.
    // The parameter SHALL be used for preventing cross-site request forgery or session fixation attacks.
    aud: string; // URL of the EHR resource server from which the app wishes to retrieve FHIR data.
    // This parameter prevents leaking a genuine bearer token to a counterfeit resource server.
    // (Note: in the case of an EHR launch flow, this aud value is the same as the launch's iss value.)
}

/**
 * A response to successful oauth request
 * according SMART on FHIR
 */
export interface AuthResponse {
    state: string; // if everyting ok --> none
    access_token: string; // The access token issued by the authorization server
    token_type: 'Bearer'; // Fixed value: Bearer
    expires_in: number; // Lifetime in seconds of the access token, after which the token SHALL NOT be accepted by the resource server
    scope: string; // Scope of access authorized. Note that this can be different from the scopes requested by the app. ("user/*.*")
    id_token?: string; // Authenticated patient identity and user details, if requested
    patient: string; // field name for user id defined by SMART on FHIR
    refresh_token: string; // Token that can be used to obtain a new access token, 
    // using the same or a subset of the original authorization grants
}

/**
 * The interface for token exchange
 * response --> request
 */
export interface TokenExchangeRequest {
    token_url: string; // url for token
    code: string; // Code that the app received from the authorization server
    redirect_uri: string; // The same redirect_uri used in the initial authorization request
    client_id: string; // Required for public apps. Omit for confidential apps.
}

/**
 * The token request payload
 */
export interface TokenRequest {
    encodedParams: HttpParams | URLSearchParams;
}

export const AUTH_RES_KEY = 'AUTH_RES';

export interface InAppBrowserSettings {
    key: InAppBrowserSettingsAll | InAppBrowserSettingsAndroid | InAppBrowserSettingsIos,
    value: string
}

/**
 * Settings dok : https://github.com/apache/cordova-plugin-inappbrowser
 */
export enum InAppBrowserSettingsAll {
    location = 'location',
    hidden = 'hidden',
    beforeload = 'beforeload',
    clearcache = 'clearcache',
    clearsessioncache = 'clearsessioncache',
    closebuttoncolor = 'closebuttoncolor',
    closebuttoncaption = 'closebuttoncaption',
    hidenavigationbuttons = 'hidenavigationbuttons',
    navigationbuttoncolor = 'navigationbuttoncolor',
    toolbarcolor = 'toolbarcolor',
    mediaPlaybackRequiresUserAction = 'mediaPlaybackRequiresUserAction',
}

/**
 * Settings dok : https://github.com/apache/cordova-plugin-inappbrowser
 */
export enum InAppBrowserSettingsAndroid {
    footer = 'footer',
    footercolor = 'footercolor',
    hardwareback = 'hardwareback',
    hideurlbar = 'hideurlbar',
    lefttoright = 'lefttoright',
    zoom = 'zoom',
    shouldPauseOnSuspend = 'shouldPauseOnSuspend',
    useWideViewPort = 'useWideViewPort'
}

/**
 * Settings dok : https://github.com/apache/cordova-plugin-inappbrowser
 */
export enum InAppBrowserSettingsIos {
    usewkwebview = 'usewkwebview',
    cleardata = 'cleardata',
    disallowoverscroll = 'disallowoverscroll',
    toolbar = 'toolbar',
    toolbartranslucent = 'toolbartranslucent',
    lefttoright = 'lefttoright',
    enableViewportScale = 'enableViewportScale',
    allowInlineMediaPlayback = 'allowInlineMediaPlayback',
    keyboardDisplayRequiresUserAction = 'keyboardDisplayRequiresUserAction',
    suppressesIncrementalRendering = 'suppressesIncrementalRendering',
    presentationstyle = 'presentationstyle',
    transitionstyle = 'transitionstyle',
    toolbarposition = 'toolbarposition',
    hidespinner = 'hidespinner'
}
