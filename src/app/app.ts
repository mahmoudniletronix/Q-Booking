import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './Components/header/header';
import { Footer } from './Components/footer/footer';
import { QBookingServices } from './Components/q-booking-services/q-booking-services';

@Component({
  selector: 'app-root',
  imports: [Header, Footer, QBookingServices],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('qBooking');
}
