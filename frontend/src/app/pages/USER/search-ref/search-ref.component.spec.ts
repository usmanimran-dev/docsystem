import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { SearchRefComponent } from './search-ref.component';

describe('SearchRefComponent', () => {
  let component: SearchRefComponent;
  let fixture: ComponentFixture<SearchRefComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchRefComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchRefComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
