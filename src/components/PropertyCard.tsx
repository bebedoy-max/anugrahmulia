import { Link } from "@tanstack/react-router";
import { Bath, BedDouble, Heart, LandPlot, MapPin, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { PropertyCard as PropertyCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

function primaryImage(property: PropertyCardType) {
  const images = [...(property.images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  return images[0]?.url ?? "/images/properti-1.jpg";
}

export function PropertyCardItem({
  property,
  favorited,
  onToggleFavorite,
}: {
  property: PropertyCardType;
  favorited?: boolean;
  onToggleFavorite?: (id: string) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border bg-card shadow-soft transition-shadow hover:shadow-lift">
      <div className="relative overflow-hidden bg-muted">
        <Link to="/properti/$slug" params={{ slug: property.slug }} className="block">
          <img
            src={primaryImage(property)}
            alt={`Foto ${property.title}`}
            loading="lazy"
            width={1280}
            height={853}
            className="block h-auto w-full"
          />
        </Link>
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge variant={property.type === "sewa" ? "secondary" : "default"} className="capitalize">
            {property.type === "sewa" ? "Disewakan" : "Dijual"}
          </Badge>
          {property.is_featured ? <Badge variant="outline" className="bg-card">Unggulan</Badge> : null}
          {property.status === "terjual" || property.status === "tersewa" ? (
            <Badge variant="destructive" className="capitalize">{property.status}</Badge>
          ) : null}
        </div>
        {onToggleFavorite ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={favorited ? "Hapus dari favorit" : "Simpan ke favorit"}
            onClick={() => onToggleFavorite(property.id)}
            className="absolute right-3 top-3 rounded-full"
          >
            <Heart className={cn("size-4", favorited && "fill-accent text-accent")} />
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <p className="font-display text-lg font-semibold text-accent">
            {formatPrice(property.price, property.type)}
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug">
            <Link to="/properti/$slug" params={{ slug: property.slug }} className="hover:text-accent">
              {property.title}
            </Link>
          </h3>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-1">
            {property.city}, {property.province}
          </span>
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
          {property.bedrooms > 0 ? (
            <li className="flex items-center gap-1.5">
              <BedDouble className="size-4" aria-hidden /> {property.bedrooms} KT
            </li>
          ) : null}
          {property.bathrooms > 0 ? (
            <li className="flex items-center gap-1.5">
              <Bath className="size-4" aria-hidden /> {property.bathrooms} KM
            </li>
          ) : null}
          {property.land_area > 0 ? (
            <li className="flex items-center gap-1.5">
              <LandPlot className="size-4" aria-hidden /> {property.land_area} m²
            </li>
          ) : null}
          {property.building_area > 0 ? (
            <li className="flex items-center gap-1.5">
              <Ruler className="size-4" aria-hidden /> {property.building_area} m²
            </li>
          ) : null}
        </ul>
      </div>
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}