import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

import { ImageUrlService } from './image-url.service';

describe('ImageUrlService', () => {
  let service: ImageUrlService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageUrlService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('getAbsoluteUrl', () => {
    it('returns empty string for falsy input', () => {
      expect(service.getAbsoluteUrl('')).toBe('');
    });

    it('passes through http(s) URLs unchanged', () => {
      expect(service.getAbsoluteUrl('http://example.com/a.jpg')).toBe(
        'http://example.com/a.jpg'
      );
    });

    it('passes through local file URI schemes unchanged', () => {
      expect(service.getAbsoluteUrl('file:///tmp/a.jpg')).toBe(
        'file:///tmp/a.jpg'
      );
    });
  });

  describe('resolveImageSrc', () => {
    it('returns null for an empty/undefined stored value', async () => {
      expect(await service.resolveImageSrc(undefined)).toBeNull();
      expect(await service.resolveImageSrc(null)).toBeNull();
      expect(await service.resolveImageSrc('')).toBeNull();
    });

    it('returns null for a dead blob: URL instead of attempting to load it (Spec 012)', async () => {
      expect(
        await service.resolveImageSrc('blob:http://localhost/abc-123')
      ).toBeNull();
    });

    it('passes through a legacy backend-relative path via getAbsoluteUrl', async () => {
      const resolved = await service.resolveImageSrc('some-image.jpg');
      expect(resolved).toContain('some-image.jpg');
    });

    it('resolves a durable Filesystem marker URI on web via Filesystem.readFile', async () => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(Filesystem, 'readFile').and.returnValue(
        Promise.resolve({ data: 'BASE64DATA' } as any)
      );

      const resolved = await service.resolveImageSrc(
        'qrganize-fs://DATA/photo.jpg'
      );

      expect(resolved).toBe('data:image/jpeg;base64,BASE64DATA');
    });

    it('resolves a durable Filesystem marker URI on native via getUri + convertFileSrc', async () => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      spyOn(Filesystem, 'getUri').and.returnValue(
        Promise.resolve({ uri: 'file:///data/photo.jpg' } as any)
      );
      spyOn(Capacitor, 'convertFileSrc').and.returnValue(
        'capacitor://localhost/_capacitor_file_/data/photo.jpg'
      );

      const resolved = await service.resolveImageSrc(
        'qrganize-fs://DATA/photo.jpg'
      );

      expect(resolved).toBe(
        'capacitor://localhost/_capacitor_file_/data/photo.jpg'
      );
    });

    it('returns null when the underlying file read fails on web', async () => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      spyOn(Filesystem, 'readFile').and.returnValue(
        Promise.reject(new Error('not found'))
      );

      const resolved = await service.resolveImageSrc(
        'qrganize-fs://DATA/missing.jpg'
      );

      expect(resolved).toBeNull();
    });
  });

  describe('persistPickedFile', () => {
    it('writes the file to durable Filesystem storage and returns a marker URI', async () => {
      const writeFileSpy = spyOn(Filesystem, 'writeFile').and.returnValue(
        Promise.resolve({ uri: 'file:///data/whatever.jpg' } as any)
      );
      const file = new File(['fake-image-bytes'], 'photo.jpg', {
        type: 'image/jpeg',
      });

      const uri = await service.persistPickedFile(file);

      expect(writeFileSpy).toHaveBeenCalled();
      expect(uri.startsWith('qrganize-fs://DATA/')).toBeTrue();
      expect(uri.endsWith('.jpg')).toBeTrue();
    });
  });
});
