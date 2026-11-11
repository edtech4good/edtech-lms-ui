import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import en from '@angular/common/locales/en';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { JwtModule, JWT_OPTIONS } from '@auth0/angular-jwt';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { NzConfig, NZ_CONFIG } from 'ng-zorro-antd/core/config';
import { en_US, NZ_I18N } from 'ng-zorro-antd/i18n';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { environment } from 'src/environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { IconsProviderModule } from './icons-provider.module';
import { PageNotFoundComponent } from './modules/page-not-found/page-not-found.component';
import { UnAuthorizedComponent } from './modules/un-authorized/un-authorized.component';
import { metaReducers, reducers } from './reducers';
import { CoreService } from './services/core.service';
import { TokenService } from './services/token.service';
import { SharedModule } from './shared/shared.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import 'src/app/services/grammarly';
registerLocaleData(en);

export const jwtoptionsfactory = (
  tokenService: TokenService,
  core: CoreService
) => ({
  tokenGetter: () => tokenService.gettoken(),
  authScheme: () => 'Bearer ',
  skipWhenExpired: true,
  allowedDomains: [core.COREDOMAIN()],
});
/** Every admin notice sits at the bottom left, app-wide, so none covers the Create and Sync buttons at the top right of a list. No call sets its own placement. */
const NOTICE_CONFIG: NzConfig = { notification: { nzPlacement: 'bottomLeft' } };

@NgModule({ declarations: [AppComponent, PageNotFoundComponent, UnAuthorizedComponent],
    bootstrap: [AppComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA], imports: [BrowserModule,
        AppRoutingModule,
        CoreModule,
        FormsModule,
        BrowserAnimationsModule,
        SharedModule,
        IconsProviderModule,
        EffectsModule.forRoot(),
        NzLayoutModule,
        NzMenuModule,
        JwtModule.forRoot({
            jwtOptionsProvider: {
                provide: JWT_OPTIONS,
                useFactory: jwtoptionsfactory,
                deps: [TokenService, CoreService],
            },
        }),
        StoreModule.forRoot(reducers, {
            metaReducers,
            runtimeChecks: {
                strictStateImmutability: true,
                strictActionImmutability: true,
            },
        }),
        !environment.production
            ? StoreDevtoolsModule.instrument({
                name: 'FortyK LMS App',
                maxAge: 25,
                logOnly: environment.production,
                connectInZone: true
            })
            : [],
        NgxPermissionsModule.forRoot()], providers: [{ provide: NZ_I18N, useValue: en_US }, { provide: NZ_CONFIG, useValue: NOTICE_CONFIG }, provideHttpClient(withInterceptorsFromDi())] })
export class AppModule {}
