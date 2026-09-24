import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { appState } from './store/appstate/appstate.reducer';
import { getappLoading } from './store/appstate/appstate.selector';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.less'],
    standalone: false
})
export class AppComponent  {

}
