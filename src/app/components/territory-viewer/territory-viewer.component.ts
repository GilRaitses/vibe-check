import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';

@Component({
  selector: 'app-territory-viewer',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  template: `
    <div>
      <h2>Territory Viewer</h2>
      <google-map height="600px" width="100%" [center]="mapCenter" [zoom]="mapZoom">
        <!-- Map content will be added here -->
      </google-map>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 20px;
      }
    `,
  ],
})
export class TerritoryViewerComponent {
  mapCenter = { lat: 40.7128, lng: -74.006 }; // New York City coordinates
  mapZoom = 12;

  constructor() {}
}