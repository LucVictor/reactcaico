import { photoUrl, type ReceiptPhoto } from "./types";

/** Galeria compacta de fotos de um item de recebimento. */
export default function ReceiptPhotoGallery({
  title,
  photos,
  emptyLabel,
}: {
  title: string;
  photos: ReceiptPhoto[];
  emptyLabel?: string;
}) {
  const validPhotos = (photos ?? []).filter((photo) => photo?.url);

  if (validPhotos.length === 0) {
    if (!emptyLabel) return null;
    return (
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {title}
        </p>
        <p className="text-xs text-gray-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {title} ({validPhotos.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {validPhotos.map((photo) => {
          const url = photoUrl(photo.url);
          if (!url) return null;
          return (
            <a
              key={photo.id}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg ring-1 ring-gray-300 transition hover:ring-blue-500 dark:ring-gray-600"
            >
              <img
                src={url}
                alt={`Foto ${photo.photo_type}`}
                className="h-20 w-20 object-cover"
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}
