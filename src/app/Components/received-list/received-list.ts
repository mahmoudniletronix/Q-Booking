import { Component } from '@angular/core';
import { ScheduleServices, Slot } from '../../service/schedule/schedule-services';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-received-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './received-list.html',
  styleUrl: './received-list.css',
})
export class ReceivedList {
  clinicId!: number;
  doctorId!: number;
  day!: number;
  items: Slot[] = [];

  constructor(private r: ActivatedRoute, private router: Router, public sch: ScheduleServices) {
    this.r.paramMap.subscribe((p) => {
      this.clinicId = +p.get('clinicId')!;
      this.doctorId = +p.get('doctorId')!;
      this.day = +p.get('day')!;
      this.items = this.sch.receivedSlots(this.clinicId, this.doctorId, this.day);
    });
    this.items = this.sch
      .slots(this.clinicId, this.doctorId, this.day)
      .filter(
        (s) => s.type !== 'empty' && s.timeSlot && !s.timeSlot.toLowerCase().includes('extra')
      );
  }

  goEdit(s: Slot) {
    this.router.navigate(['/patient/edit', this.clinicId, this.doctorId, this.day, s.ticket!.id]);
  }
  back() {
    this.router.navigate(['/']);
  }
  trackBySlot = (_: number, s: Slot) => s.index;
}
