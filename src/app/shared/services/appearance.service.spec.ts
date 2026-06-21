import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';
import { AppearanceService } from './appearance.service';

describe('AppearanceService', () => {
  let service: AppearanceService;
  let storageSpy: jasmine.SpyObj<Storage>;
  let matchMediaSpy: jasmine.Spy;
  let mediaQueryListenerCalls: Array<{
    type: string;
    listener: EventListener;
  }>;

  beforeEach(() => {
    document.body.classList.remove(
      'dark',
      'font-small',
      'font-medium',
      'font-large'
    );

    storageSpy = jasmine.createSpyObj('Storage', ['get', 'set']);

    mediaQueryListenerCalls = [];

    matchMediaSpy = jasmine
      .createSpy('matchMedia')
      .and.callFake((query: string) => {
        const mql = {
          matches: false,
          media: query,
          addEventListener: (type: string, listener: EventListener) => {
            mediaQueryListenerCalls.push({ type, listener });
          },
          removeEventListener: (type: string, listener: EventListener) => {
            mediaQueryListenerCalls = mediaQueryListenerCalls.filter(
              (entry) => entry.listener !== listener
            );
          },
        };
        return mql as unknown as MediaQueryList;
      });
    (window as any).matchMedia = matchMediaSpy;

    TestBed.configureTestingModule({
      providers: [
        AppearanceService,
        { provide: Storage, useValue: storageSpy },
      ],
    });

    service = TestBed.inject(AppearanceService);
  });

  afterEach(() => {
    document.body.classList.remove(
      'dark',
      'font-small',
      'font-medium',
      'font-large'
    );
  });

  it('applyTheme("light") removes the dark class', () => {
    document.body.classList.add('dark');
    service.applyTheme('light');
    expect(document.body.classList.contains('dark')).toBeFalse();
  });

  it('applyTheme("dark") adds the dark class', () => {
    service.applyTheme('dark');
    expect(document.body.classList.contains('dark')).toBeTrue();
  });

  it('applyTheme("system") sets the dark class from matchMedia and attaches a listener', () => {
    matchMediaSpy.and.callFake((query: string) => {
      const mql = {
        matches: true,
        media: query,
        addEventListener: (type: string, listener: EventListener) => {
          mediaQueryListenerCalls.push({ type, listener });
        },
        removeEventListener: () => {},
      };
      return mql as unknown as MediaQueryList;
    });

    service.applyTheme('system');

    expect(document.body.classList.contains('dark')).toBeTrue();
    expect(mediaQueryListenerCalls.length).toBe(1);
    expect(mediaQueryListenerCalls[0].type).toBe('change');
  });

  it('detaches the system listener when switching to an explicit theme', () => {
    service.applyTheme('system');
    expect(mediaQueryListenerCalls.length).toBe(1);

    service.applyTheme('light');
    expect(mediaQueryListenerCalls.length).toBe(0);
  });

  it('applyFontSize swaps font-* classes on document.body', () => {
    service.applyFontSize('large');
    expect(document.body.classList.contains('font-large')).toBeTrue();

    service.applyFontSize('small');
    expect(document.body.classList.contains('font-large')).toBeFalse();
    expect(document.body.classList.contains('font-small')).toBeTrue();
  });

  it('loadAndApplyPersistedAppearance defaults to system/medium when unset', async () => {
    storageSpy.get.and.returnValue(Promise.resolve(null));

    await service.loadAndApplyPersistedAppearance();

    expect(storageSpy.get).toHaveBeenCalledWith('theme');
    expect(storageSpy.get).toHaveBeenCalledWith('fontSize');
    expect(document.body.classList.contains('font-medium')).toBeTrue();
  });

  it('loadAndApplyPersistedAppearance applies persisted values', async () => {
    storageSpy.get.and.callFake((key: string) => {
      if (key === 'theme') {
        return Promise.resolve('dark');
      }
      if (key === 'fontSize') {
        return Promise.resolve('large');
      }
      return Promise.resolve(null);
    });

    await service.loadAndApplyPersistedAppearance();

    expect(document.body.classList.contains('dark')).toBeTrue();
    expect(document.body.classList.contains('font-large')).toBeTrue();
  });
});
