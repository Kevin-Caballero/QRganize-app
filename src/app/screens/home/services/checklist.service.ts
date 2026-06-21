import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { LocalChecklistsService } from 'src/app/shared/services/local-checklists.service';
import { LocalChecklist } from 'src/app/shared/models/local-checklist';

export interface ChecklistCompletion {
  total: number;
  completed: number;
}

/**
 * Home/Search-facing checklist service (Spec 013). Mirrors `BoxService`'s
 * thin-Observable-wrapper-around-Feature-Service pattern so pages (e.g.
 * `search.page.ts`) never call `LocalChecklistsService` or any repository
 * directly, per `docs/architecture.md`'s mandatory layering.
 */
@Injectable({
  providedIn: 'root',
})
export class ChecklistService {
  constructor(private localChecklistsService: LocalChecklistsService) {}

  /**
   * Searches checklists by title/description, OR by any of their checklist
   * items' titles — case-insensitive substring match, mirroring
   * `BoxService.searchBoxes()`'s matching style.
   */
  searchChecklists(term: string): Observable<LocalChecklist[]> {
    const lowerTerm = term.toLowerCase();

    return from(this.searchChecklistsAsync(lowerTerm));
  }

  private async searchChecklistsAsync(
    lowerTerm: string
  ): Promise<LocalChecklist[]> {
    const checklists = await this.localChecklistsService.getAllChecklists();
    if (checklists.length === 0) {
      return [];
    }

    const matches: LocalChecklist[] = [];

    for (const checklist of checklists) {
      const titleMatches = checklist.title.toLowerCase().includes(lowerTerm);
      const descriptionMatches = (checklist.description ?? '')
        .toLowerCase()
        .includes(lowerTerm);

      if (titleMatches || descriptionMatches) {
        matches.push(checklist);
        continue;
      }

      const items = await this.localChecklistsService.getChecklistItems(
        checklist.id
      );
      const itemMatches = items.some((item) =>
        item.title.toLowerCase().includes(lowerTerm)
      );
      if (itemMatches) {
        matches.push(checklist);
      }
    }

    return matches;
  }

  /**
   * Completion counts for a checklist (total/completed items), mirroring
   * `checklists.page.ts`'s `getCompletionPercentage()` data source —
   * `search.page.ts` uses this to compute the same percentage without
   * calling `LocalChecklistsService` directly.
   */
  getChecklistCompletion(checklistId: string): Observable<ChecklistCompletion> {
    return from(
      this.localChecklistsService
        .getChecklistItems(checklistId)
        .then((items) => ({
          total: items.length,
          completed: items.filter((item) => item.isCompleted).length,
        }))
    );
  }
}
