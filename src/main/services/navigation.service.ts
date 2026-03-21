export interface Modal {
  id: string;
  type: string;
  data?: any;
}

export interface NavigationState {
  currentView: string;
  breadcrumbs: string[];
  history: string[];
  modals: Modal[];
  activeProject?: string;
}

export class NavigationService {
  private state: NavigationState = {
    currentView: 'dashboard',
    breadcrumbs: ['Dashboard'],
    history: ['dashboard'],
    modals: [],
  };

  private backStack: string[] = [];
  private forwardStack: string[] = [];
  private listeners: Array<(view: string) => void> = [];
  private validRoutes = new Set([
    'dashboard',
    'projects',
    'mixer',
    'arrange',
    'settings',
    'library',
    'export',
  ]);

  constructor(dbPath: string = ':memory:') {
    // Database could be used for persisting navigation state
  }

  getNavigationState(): NavigationState {
    return { ...this.state };
  }

  navigateTo(view: string, params?: any): void {
    if (!this.isValidRoute(view)) {
      console.warn(`Invalid route: ${view}`);
      return;
    }

    // Add current view to back stack before navigating
    if (this.state.currentView !== view) {
      this.backStack.push(this.state.currentView);
      this.forwardStack = []; // Clear forward stack on new navigation
    }

    this.state.currentView = view;
    this.state.history.push(view);

    // Update breadcrumbs
    const parts = view.split('/');
    this.state.breadcrumbs = parts.map((part, index) => {
      return parts.slice(0, index + 1).join('/');
    });

    // Notify listeners
    this.listeners.forEach((listener) => listener(view));
  }

  goBack(): void {
    if (this.backStack.length > 0) {
      this.forwardStack.push(this.state.currentView);
      this.state.currentView = this.backStack.pop()!;

      this.listeners.forEach((listener) => listener(this.state.currentView));
    }
  }

  goForward(): void {
    if (this.forwardStack.length > 0) {
      this.backStack.push(this.state.currentView);
      this.state.currentView = this.forwardStack.pop()!;

      this.listeners.forEach((listener) => listener(this.state.currentView));
    }
  }

  openModal(type: string, data?: any): string {
    const id = `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const modal: Modal = { id, type, data };
    this.state.modals.push(modal);

    return id;
  }

  closeModal(modalId: string): void {
    this.state.modals = this.state.modals.filter((m) => m.id !== modalId);
  }

  getCurrentRoute(): string {
    return this.state.currentView;
  }

  onNavigationChange(listener: (view: string) => void): void {
    this.listeners.push(listener);
  }

  setActiveProject(projectId: string): void {
    this.state.activeProject = projectId;
  }

  resetToHome(): void {
    this.state.currentView = 'dashboard';
    this.state.breadcrumbs = ['Dashboard'];
    this.state.history = ['dashboard'];
    this.state.modals = [];

    this.listeners.forEach((listener) => listener('dashboard'));
  }

  isValidRoute(route: string): boolean {
    const basePath = route.split('/')[0];
    return this.validRoutes.has(basePath);
  }

  getBreadcrumbs(): string[] {
    return [...this.state.breadcrumbs];
  }

  getNavigationHistory(): string[] {
    return [...this.state.history];
  }

  clearModals(): void {
    this.state.modals = [];
  }
}
