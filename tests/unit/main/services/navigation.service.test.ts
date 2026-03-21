import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavigationService } from '../../../../src/main/services/navigation.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('NavigationService', () => {
  let navigation: NavigationService;

  beforeEach(() => {
    navigation = new NavigationService(':memory:');
    vi.clearAllMocks();
  });

  it('initializes navigation state', async () => {
    const state = navigation.getNavigationState();

    expect(state).toBeDefined();
    expect(state).toHaveProperty('currentView');
    expect(state).toHaveProperty('breadcrumbs');
    expect(state).toHaveProperty('history');
  });

  it('navigates to view', async () => {
    navigation.navigateTo('projects');

    const state = navigation.getNavigationState();
    expect(state.currentView).toBe('projects');
  });

  it('updates breadcrumbs when navigating', async () => {
    navigation.navigateTo('projects');
    navigation.navigateTo('projects/123');
    navigation.navigateTo('projects/123/tracks');

    const state = navigation.getNavigationState();
    expect(state.breadcrumbs.length).toBeGreaterThan(0);
    expect(state.breadcrumbs[state.breadcrumbs.length - 1]).toContain('tracks');
  });

  it('maintains navigation history', async () => {
    navigation.navigateTo('dashboard');
    navigation.navigateTo('projects');
    navigation.navigateTo('settings');

    const state = navigation.getNavigationState();
    expect(state.history.length).toBeGreaterThan(0);
  });

  it('navigates back in history', async () => {
    navigation.navigateTo('dashboard');
    navigation.navigateTo('projects');
    navigation.navigateTo('settings');

    navigation.goBack();

    const state = navigation.getNavigationState();
    expect(state.currentView).toBe('projects');
  });

  it('navigates forward in history', async () => {
    navigation.navigateTo('dashboard');
    navigation.navigateTo('projects');
    navigation.navigateTo('settings');
    navigation.goBack();

    navigation.goForward();

    const state = navigation.getNavigationState();
    expect(state.currentView).toBe('settings');
  });

  it('handles modal navigation', async () => {
    const modalId = navigation.openModal('export', { format: 'mp3' });

    expect(modalId).toBeDefined();

    const state = navigation.getNavigationState();
    expect(state.modals.some((m) => m.id === modalId)).toBe(true);
  });

  it('closes modal by ID', async () => {
    const modalId = navigation.openModal('export', {});

    navigation.closeModal(modalId);

    const state = navigation.getNavigationState();
    expect(state.modals.some((m) => m.id === modalId)).toBe(false);
  });

  it('handles nested navigation routes', async () => {
    navigation.navigateTo('projects/proj-123/arrange');

    const route = navigation.getCurrentRoute();

    expect(route).toContain('projects');
    expect(route).toContain('arrange');
  });

  it('registers navigation listener', async () => {
    let lastView = '';
    navigation.onNavigationChange((view) => {
      lastView = view;
    });

    navigation.navigateTo('mixer');

    expect(lastView).toBe('mixer');
  });

  it('has project-specific views', async () => {
    const projectId = 'proj-123';
    navigation.setActiveProject(projectId);

    const state = navigation.getNavigationState();
    expect(state.activeProject).toBe(projectId);
  });

  it('resets navigation to home', async () => {
    navigation.navigateTo('projects');
    navigation.navigateTo('settings');

    navigation.resetToHome();

    const state = navigation.getNavigationState();
    expect(state.currentView).toBe('dashboard');
  });

  it('validates navigation routes', async () => {
    const isValid = navigation.isValidRoute('dashboard');
    expect(isValid).toBe(true);

    const isInvalid = navigation.isValidRoute('nonexistent-route');
    expect(isInvalid).toBe(false);
  });

  it('gets breadcrumb trail', async () => {
    navigation.navigateTo('projects');
    navigation.navigateTo('projects/123');
    navigation.navigateTo('projects/123/tracks');

    const breadcrumbs = navigation.getBreadcrumbs();

    expect(Array.isArray(breadcrumbs)).toBe(true);
    expect(breadcrumbs.length).toBeGreaterThan(0);
  });

  it('can navigate with parameters', async () => {
    navigation.navigateTo('projects/proj-123', { tab: 'tracks', view: 'arrange' });

    const state = navigation.getNavigationState();
    expect(state.currentView).toContain('projects');
  });

  it('tracks view transitions', async () => {
    navigation.navigateTo('dashboard');
    navigation.navigateTo('projects');
    navigation.navigateTo('settings');

    const transitions = navigation.getNavigationHistory();

    expect(transitions.length).toBeGreaterThanOrEqual(3);
  });

  it('clears modal stack', async () => {
    navigation.openModal('export', {});
    navigation.openModal('import', {});
    navigation.openModal('settings', {});

    navigation.clearModals();

    const state = navigation.getNavigationState();
    expect(state.modals.length).toBe(0);
  });
});
