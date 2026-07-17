import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { first } from 'rxjs/operators';
@Component({
    selector: 'app-student-details',
    templateUrl: './student-details.component.html',
    styleUrls: ['./student-details.component.less'],
    standalone: false
})
export class StudentDetailsComponent implements OnInit {
  constructor(private router: RouterOutlet) {}

  async ngOnInit() {
    this.router.activatedRoute.params.pipe(first()).subscribe((res) => {
      console.log(res);
    });
  }
}
