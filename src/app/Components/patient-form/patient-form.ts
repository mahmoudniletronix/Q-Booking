import { Component } from '@angular/core';
import { ScheduleServices, Ticket } from '../../service/schedule/schedule-services';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './patient-form.html',
  styleUrl: './patient-form.css',
})
export class PatientForm {
  mode: 'add' | 'edit' = 'add';
  clinicId!: number;
  doctorId!: number;
  day!: number;
  slotIndex: number | null = null;
  ticketId: number | null = null;

  model: Ticket = { id: 0, patient: '', phone: '', status: 'Received' };
  timeInfo = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public sch: ScheduleServices
  ) {
    this.route.params.subscribe((p) => {
      const path = this.route.snapshot.routeConfig?.path ?? '';
      if (path.startsWith('patient/add')) this.mode = 'add';
      if (path.startsWith('patient/edit')) this.mode = 'edit';

      this.clinicId = +p['clinicId'];
      this.doctorId = +p['doctorId'];
      this.day = +p['day'];

      if (this.mode === 'add') {
        this.slotIndex = +p['slotIndex'];
        const label = this.sch.getTimeSlotLabel(this.slotIndex!);
        this.timeInfo = label;
        this.model.timeSlot = label;
      } else {
        this.ticketId = +p['ticketId'];
        const t = this.sch.getTicketById(this.clinicId, this.doctorId, this.day, this.ticketId);
        if (t) this.model = { ...t };
        this.timeInfo = this.model.timeSlot ?? '';
      }
    });
  }

  save() {
    if (!this.model.patient || !this.model.phone) return;

    if (this.mode === 'add') {
      this.model.id = Date.now();
      this.sch.addAtSlot(this.clinicId, this.doctorId, this.day, this.slotIndex!, this.model);
      alert('✅ Patient added successfully!');
    } else {
      this.sch.updateTicket(this.clinicId, this.doctorId, this.day, this.model);
      alert('✅ Patient updated successfully!');
    }
    this.goBack();
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
