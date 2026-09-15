import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createItem, uploadItemImages } from '../api/items';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { CATEGORIES } from '../constants/categories';
import { LOCATIONS } from '../constants/locations';
import type { BorrowType, BrowseItem } from '../types/item';
import { SelectField, TextareaField, TextField } from '../components/FormField';
import ItemCard from '../components/ItemCard';
import Toast, { useToast } from '../components/Toast';

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message: toastMessage, showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [borrowType, setBorrowType] = useState<BorrowType>('FREE');
  const [pricePerDay, setPricePerDay] = useState('');
  const [instructions, setInstructions] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'draft' | 'publish' | null>(null);

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  function handleAddPhoto(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setImageError(null);
    const room = MAX_IMAGES - images.length;
    const candidates = files.slice(0, room);
    if (files.length > room) {
      setImageError(`You can upload at most ${MAX_IMAGES} images.`);
    }

    for (const file of candidates) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        setImageError('Only JPEG, PNG, WEBP, or GIF images are allowed.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError('Each image must be 5MB or smaller.');
        return;
      }
    }

    setImages((prev) => [...prev, ...candidates]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  const isPaid = borrowType === 'PAID';
  const previewItem: BrowseItem = {
    id: 'preview',
    title: title || 'Your item title',
    category,
    location,
    borrowType,
    pricePerDay: isPaid && pricePerDay ? pricePerDay : null,
    status: 'AVAILABLE',
    imageUrl: imagePreviews[0] ?? null,
    ownerId: user?.id ?? '',
    ownerName: user?.fullName ?? '',
    ownerAverageRating: user?.averageRating ?? '0.00',
  };

  async function submit(mode: 'draft' | 'publish') {
    setFormError(null);
    setFieldErrors({});

    if (isPaid && !pricePerDay) {
      setFieldErrors({ pricePerDay: 'Price per day is required for a paid item' });
      return;
    }

    setSubmitting(mode);
    try {
      // The backend has no separate "lending instructions" column — fold
      // them into the description (clearly labeled) rather than inventing
      // a field the schema doesn't support.
      const fullDescription = instructions.trim()
        ? `${description.trim()}\n\nLending instructions: ${instructions.trim()}`
        : description.trim();

      const { item } = await createItem({
        title: title.trim(),
        description: fullDescription,
        category,
        location,
        borrowType,
        pricePerDay: isPaid ? Number.parseFloat(pricePerDay) : undefined,
      });

      if (images.length > 0) {
        try {
          await uploadItemImages(item.id, images);
        } catch {
          showToast('Listing published, but the photos failed to upload');
        }
      }

      if (mode === 'publish') {
        navigate(`/items/${item.id}`);
      } else {
        showToast('Saved — your listing is live on Explore');
        setTitle('');
        setDescription('');
        setInstructions('');
        setImages([]);
        setPricePerDay('');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(null);
    }
  }

  const busy = submitting !== null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-7">
      <h2 className="text-[32px]">List an item</h2>
      <p className="mb-6 mt-1 text-ink/60">Lend something you&rsquo;re not using this semester.</p>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="grid gap-4">
          {formError && <p className="rounded-2xl bg-danger-bg px-4 py-2.5 text-sm font-medium text-danger-text">{formError}</p>}

          <div className="rounded-card border border-ink/10 bg-white p-6">
            <p className="mb-3.5 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">1 · The basics</p>
            <div className="grid gap-3.5">
              <TextField
                label="Item title"
                id="title"
                placeholder="e.g. Casio FX-991EX Calculator"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={fieldErrors.title}
                required
              />
              <TextareaField
                label="Description"
                id="description"
                placeholder="Condition, what's included, anything a borrower should know."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={fieldErrors.description}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Category" id="category" value={category} onChange={(e) => setCategory(e.target.value)} error={fieldErrors.category}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Pickup location" id="location" value={location} onChange={(e) => setLocation(e.target.value)} error={fieldErrors.location}>
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-ink/10 bg-white p-6">
            <p className="mb-3.5 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">
              2 · Photos <span className="font-semibold normal-case tracking-normal text-ink/40">— up to {MAX_IMAGES}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {imagePreviews.map((src, index) => (
                <div key={src} className="relative h-[104px] w-[104px] overflow-hidden rounded-tile">
                  <img src={src} alt={`Upload ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-sm text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="flex h-[104px] w-[104px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-tile border-[1.5px] border-dashed border-ink/25 text-xs font-semibold text-ink/50 hover:border-primary hover:text-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4M8 8l4-4 4 4" />
                    <path d="M4 18v2h16v-2" />
                  </svg>
                  Add photo
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleAddPhoto} />
                </label>
              )}
            </div>
            {imageError && <p className="mt-2.5 text-xs font-medium text-danger-text">{imageError}</p>}
          </div>

          <div className="rounded-card border border-ink/10 bg-white p-6">
            <p className="mb-3.5 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">3 · Price &amp; rules</p>
            <div className="mb-3.5 flex gap-2">
              <button
                type="button"
                onClick={() => setBorrowType('FREE')}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${!isPaid ? 'bg-primary text-white' : 'bg-bg text-ink/70'}`}
              >
                Free to borrow
              </button>
              <button
                type="button"
                onClick={() => setBorrowType('PAID')}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${isPaid ? 'bg-primary text-white' : 'bg-bg text-ink/70'}`}
              >
                Paid per day
              </button>
            </div>

            {isPaid && (
              <div className="mb-3.5 max-w-[180px]">
                <TextField
                  label="Price per day (GHS)"
                  id="pricePerDay"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="5"
                  value={pricePerDay}
                  onChange={(e) => setPricePerDay(e.target.value)}
                  error={fieldErrors.pricePerDay}
                  required
                />
              </div>
            )}

            <TextareaField
              label="Lending instructions"
              id="instructions"
              placeholder="e.g. Pick up between 5pm and 8pm at Unity Hall porter's lodge."
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => submit('draft')}
              disabled={busy}
              className="rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-bold transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting === 'draft' ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => submit('publish')}
              disabled={busy}
              className="rounded-full bg-primary px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting === 'publish' ? 'Publishing…' : 'Publish Item'}
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-[76px] lg:self-start">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Live preview</p>
          <ItemCard item={previewItem} disableLink />
          <p className="mt-3 text-xs text-ink/50">This is exactly how your listing appears on the Explore page.</p>
        </div>
      </div>

      <Toast message={toastMessage} />
    </main>
  );
}
