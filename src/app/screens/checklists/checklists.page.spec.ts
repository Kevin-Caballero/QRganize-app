import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChecklistsPage } from './checklists.page';

describe('ChecklistsPage', () => {
  let component: ChecklistsPage;
  let fixture: ComponentFixture<ChecklistsPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(ChecklistsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
