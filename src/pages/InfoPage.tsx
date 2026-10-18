import React from 'react';
import { ChevronRight } from 'lucide-react';
import { CategoryType } from '../types/news';
import { INFO_PAGES, InfoPageId } from '../config/infoPages';
import { InfoContent } from '../components/InfoContent';
import { SpaLink } from '../components/SpaLink';

interface InfoPageProps {
  id: InfoPageId;
  onSelectCategory: (cat: CategoryType) => void;
}

/** A company / legal page (About, Contact, Privacy...) at its own address. The footer shows the same text in a pop-up. */
export const InfoPage: React.FC<InfoPageProps> = ({ id, onSelectCategory }) => {
  const page = INFO_PAGES.find((p) => p.id === id);
  if (!page) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-5 bg-white">
      <nav aria-label="Breadcrumb" className="border-b border-neutral-200 pb-2">
        <ol className="flex items-center gap-1.5 text-xs uppercase font-black tracking-wider text-[#005EB8]">
          <li>
            <SpaLink href="/" onNavigate={() => onSelectCategory('all')} className="hover:underline inline-block py-1">
              Home
            </SpaLink>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="w-3 h-3 text-neutral-500" />
          </li>
          <li className="text-neutral-900" aria-current="page">
            {page.title}
          </li>
        </ol>
      </nav>

      <h1 className="font-headline font-black text-3xl sm:text-4xl text-neutral-900 tracking-tight">{page.title}</h1>

      <InfoContent id={id} className="text-sm sm:text-base text-neutral-800 space-y-3 leading-relaxed" />
    </div>
  );
};
