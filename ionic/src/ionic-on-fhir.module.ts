import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { SecureStorage } from '@ionic-native/secure-storage/ngx';

import { IonicOnFhirService } from './ionic-on-fhir.service';
import { IonicOnFhirComponent } from './ionic-on-fhir.component';

@NgModule({
    imports: [CommonModule],
    providers: [InAppBrowser, SecureStorage, IonicOnFhirService],
    declarations: [IonicOnFhirComponent],
    
})
export class IonicOnFhirModule{}