import { Routes } from '@angular/router';
import { QBookingServices } from './Components/q-booking-services/q-booking-services';
import { PatientForm } from './Components/patient-form/patient-form';
import { ReceivedList } from './Components/received-list/received-list';
import { AvailableList } from './Components/available-list/available-list';

export const routes: Routes = [
  {
    path: '',
    component: QBookingServices,
    // data: { pageTitle: 'Main' },
  },
  {
    path: 'patient/received/:clinicId/:doctorId/:day',
    component: ReceivedList,
    // data: { pageTitle: 'Reserved Appointments' },
  },
  {
    path: 'patient/available/:clinicId/:doctorId/:day',
    component: AvailableList,
    // data: { pageTitle: 'Available Slots' },
  },
  {
    path: 'patient/add/:clinicId/:doctorId/:day/:slotIndex',
    component: PatientForm,
    // data: { pageTitle: 'Add Patient' },
  },
  {
    path: 'patient/edit/:clinicId/:doctorId/:day/:ticketId',
    component: PatientForm,
    // data: { pageTitle: 'Edit Patient' },
  },
  { path: '**', redirectTo: '' },
];
