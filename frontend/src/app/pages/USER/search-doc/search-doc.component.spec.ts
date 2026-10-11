import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { SearchDocComponent } from './search-doc.component';

describe('SearchDocComponent', () => {
  let component: SearchDocComponent;
  let fixture: ComponentFixture<SearchDocComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchDocComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchDocComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
