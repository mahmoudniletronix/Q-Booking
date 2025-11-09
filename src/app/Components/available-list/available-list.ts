import { Component } from '@angular/core';
import { ScheduleServices, Slot } from '../../service/schedule/schedule-services';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-available-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './available-list.html',
  styleUrl: './available-list.css',
})
export class AvailableList {
  clinicId!: number;
  doctorId!: number;
  day!: number;
  slots: Slot[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public sch: ScheduleServices
  ) {
    this.route.paramMap.subscribe((p) => {
      this.clinicId = +p.get('clinicId')!;
      this.doctorId = +p.get('doctorId')!;
      this.day = +p.get('day')!;

      const all = this.sch
        .slots(this.clinicId, this.doctorId, this.day)
        .filter((s) => s.timeSlot && !s.timeSlot.toLowerCase().includes('extra'));

      this.slots = all;
    });
  }

  onSlotClick(s: Slot) {
    if (s.type === 'empty') {
      this.router.navigate(['/patient/add', this.clinicId, this.doctorId, this.day, s.index]);
    } else {
      this.router.navigate(['/patient/edit', this.clinicId, this.doctorId, this.day, s.ticket!.id]);
    }
  }

  back() {
    this.router.navigate(['/']);
  }

  trackBySlot = (_: number, s: Slot) => s.index;
}
