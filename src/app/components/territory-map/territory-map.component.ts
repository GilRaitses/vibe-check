import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';
import { TerritoryService, Territory } from '../../services/territory.service';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-territory-map',
  standalone: true,
  imports: [
    CommonModule,
    GoogleMapsModule
  ],
  template: `
    <div class="map-container">
      <google-map
        height="100%"
        width="100%"
        [zoom]="12"
        [center]="nycCenter"
        [options]="mapOptions"
      >
        <map-polygon
          *ngFor="let territory of territories$ | async"
          [paths]="territory.coordinates || []"
          [options]="getPolygonOptions(territory.safetyScore)"
          (polygonClick)="onTerritoryClick(territory)"
        ></map-polygon>
      </google-map>

      <div *ngIf="selectedTerritory" class="territory-info-overlay">
        <h3>Territory Details</h3>
        <p>ID: {{ selectedTerritory.territoryId }}</p>
        <p>Safety Score: {{ selectedTerritory.safetyScore }}/10</p>
        <p>Total Analyses: {{ selectedTerritory.totalAnalyses }}</p>
        <p>Total Reports: {{ selectedTerritory.totalReports }}</p>
        <button (click)="closeTerritoryInfo()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      position: relative;
    }
    .map-container {
      height: 100%;
      width: 100%;
      position: relative;
    }
    .territory-info-overlay {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(255, 255, 255, 0.9);
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 10;
      text-align: center;
    }
    .territory-info-overlay h3 {
      margin-top: 0;
      margin-bottom: 10px;
      color: #333;
    }
    .territory-info-overlay p {
      margin-bottom: 5px;
      color: #555;
    }
    .territory-info-overlay button {
      margin-top: 10px;
      padding: 8px 15px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    }
    .territory-info-overlay button:hover {
      background-color: #0056b3;
    }
  `]
})
export class TerritoryMapComponent implements OnInit {
  nycCenter = { lat: 40.7128, lng: -74.0060 };
  territories$: Observable<Territory[]>;
  selectedTerritory: Territory | null = null;

  mapOptions: google.maps.MapOptions = {
    zoomControl: true,
    scrollwheel: true,
    disableDoubleClickZoom: false,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    maxZoom: 18,
    minZoom: 8,
  };

  constructor(private territoryService: TerritoryService) {
    this.territories$ = this.territoryService.getAllTerritories();
  }

  ngOnInit(): void {
    // Load Google Maps API with the key
    if (!window.google) {
      this.loadGoogleMapsAPI();
    }
  }

  private loadGoogleMapsAPI(): void {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  getPolygonOptions(safetyScore: number): google.maps.PolygonOptions {
    let fillColor = '#4CAF50'; // Green
    if (safetyScore < 7) {
      fillColor = '#FFC107'; // Yellow
    }
    if (safetyScore < 5) {
      fillColor = '#FF9800'; // Orange
    }
    if (safetyScore < 3) {
      fillColor = '#F44336'; // Red
    }

    return {
      fillColor: fillColor,
      fillOpacity: 0.5,
      strokeColor: '#000000',
      strokeOpacity: 0.8,
      strokeWeight: 1,
      clickable: true,
    };
  }

  onTerritoryClick(territory: Territory): void {
    this.selectedTerritory = territory;
  }

  closeTerritoryInfo(): void {
    this.selectedTerritory = null;
  }
}