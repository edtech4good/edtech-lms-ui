import { Location } from '@angular/common';
import { Component } from '@angular/core';
@Component({
  selector: 'app-un-authorized',
  templateUrl: './un-authorized.component.html',
  styleUrls: ['./un-authorized.component.less'],
})
export class UnAuthorizedComponent {
  constructor(
    private readonly _location: Location,
  ) { }

  backPage() {
    this._location.back();
  }
}
