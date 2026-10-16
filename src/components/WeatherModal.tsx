import React from 'react';
import { X, CloudRain, Wind, Droplets, Compass, Sun, MapPin, Waves } from 'lucide-react';
import { WeatherData } from '../types/news';

interface WeatherModalProps {
  weather: WeatherData;
  isOpen: boolean;
  onClose: () => void;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({ weather, isOpen, onClose }) => {
  if (!isOpen) return null;

  const DISTRICT_FORECASTS = [
    { name: 'City Centre & Merchant City', temp: 12, cond: 'Passing Showers', rainChance: '45%' },
    { name: 'West End & Kelvingrove', temp: 12, cond: 'Brisk Breeze & Light Rain', rainChance: '50%' },
    { name: 'Southside & Shawlands', temp: 13, cond: 'Occasional Sunny Breaks', rainChance: '30%' },
    { name: 'East End & Dennistoun', temp: 12, cond: 'Overcast with Drizzle', rainChance: '40%' },
    { name: 'Glasgow Airport (Abbotsinch)', temp: 11, cond: 'Wind Gusts up to 24mph', rainChance: '55%' },
  ];

  const NEXT_DAYS = [
    { day: 'Friday', high: 13, low: 7, icon: CloudRain, cond: 'Breezy with showers' },
    { day: 'Saturday', high: 15, low: 9, icon: Sun, cond: 'Dry with sunny intervals' },
    { day: 'Sunday', high: 14, low: 8, icon: CloudRain, cond: 'Afternoon rain' },
    { day: 'Monday', high: 12, low: 6, icon: Sun, cond: 'Crisp Scottish autumn day' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white rounded-lg shadow-2xl border border-neutral-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0B2545] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 text-[#005EB8]" />
            <div>
              <h3 className="font-headline text-lg font-bold">Glasgow & Strathclyde Weather</h3>
              <p className="text-xs text-neutral-300">Live Strathclyde meteorological bulletin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Conditions Bar */}
        <div className="p-6 bg-[#FAF7F2] border-b border-neutral-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-neutral-200 text-[#005EB8]">
                <CloudRain className="w-10 h-10" />
              </div>
              <div>
                <div className="text-4xl font-headline font-extrabold text-[#0B2545]">
                  {weather.temp}°C
                </div>
                <div className="text-sm font-semibold text-neutral-800">
                  {weather.condition}
                </div>
                <div className="text-xs text-neutral-500">
                  High: {weather.high}°C • Low: {weather.low}°C
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-neutral-200">
              <div className="flex items-center gap-1.5 text-neutral-600">
                <Wind className="w-3.5 h-3.5 text-[#005EB8]" />
                <span>{weather.windSpeed}</span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-600">
                <Droplets className="w-3.5 h-3.5 text-[#005EB8]" />
                <span>Humidity: {weather.humidity}</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-neutral-700 font-medium">
                <Waves className="w-3.5 h-3.5 text-[#005EB8]" />
                <span>{weather.clydeTide}</span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs italic text-neutral-600 bg-amber-50/80 border border-amber-200/80 p-2.5 rounded">
            "{weather.summary}"
          </p>
        </div>

        {/* Glasgow Neighbourhoods */}
        <div className="p-5 space-y-4 max-h-80 overflow-y-auto">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] mb-2">
              District Stations
            </h4>
            <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden bg-white">
              {DISTRICT_FORECASTS.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 text-xs hover:bg-neutral-50">
                  <span className="font-medium text-neutral-800">{d.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-500">{d.cond}</span>
                    <span className="font-bold text-[#0B2545]">{d.temp}°C</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4-Day Scottish Outlook */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] mb-2">
              4-Day Outlook
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {NEXT_DAYS.map((day, i) => {
                const Icon = day.icon;
                return (
                  <div key={i} className="bg-neutral-50 border border-neutral-200 rounded p-2 text-center text-xs">
                    <div className="font-bold text-neutral-800">{day.day}</div>
                    <Icon className="w-5 h-5 mx-auto my-1.5 text-[#005EB8]" />
                    <div className="font-semibold text-neutral-900">{day.high}° / {day.low}°</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5 truncate">{day.cond}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-neutral-100 p-3 px-5 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <span>Data source: Met Office Glasgow Bishopton Station</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white border border-neutral-300 rounded hover:bg-neutral-50 text-neutral-800 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
