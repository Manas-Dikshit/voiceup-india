import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Filter } from 'lucide-react';
import Header from '@/components/Header';
import MinistryMap, { MinistryMapFilters, Correlation } from '@/components/maps/MinistryMap';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { MultiSelect } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';
import { problem_category } from '@/integrations/supabase/types';
import { DateRange } from 'react-day-picker';
import { useDebounce } from 'use-debounce';

const categoryOptions = Object.values(problem_category).map(c => ({ value: c as string, label: (c as string).charAt(0).toUpperCase() + (c as string).slice(1) }));

const MinistryDashboard = () => {
  const [filters, setFilters] = useState<MinistryMapFilters>({});
  const [mapData, setMapData] = useState<Correlation[]>([]);
  const [date, setDate] = useState<DateRange | undefined>();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState('');
  const [debouncedCity] = useDebounce(cityInput, 500); // Debounce city input by 500ms

  const handleFilterChange = (filterName: keyof MinistryMapFilters, value: any) => {
    const newFilters = { ...filters };
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[filterName];
    } else {
      newFilters[filterName] = value;
    }
    setFilters(newFilters);
  };

  useEffect(() => {
    handleFilterChange('dateRange', date ? { from: date.from, to: date.to } : undefined);
  }, [date]);

  useEffect(() => {
    handleFilterChange('categories', selectedCategories.length > 0 ? selectedCategories : undefined);
  }, [selectedCategories]);

  useEffect(() => {
    handleFilterChange('city', debouncedCity);
  }, [debouncedCity]);

  const handleExport = () => {
    if (mapData.length === 0) return;
    const headers = Object.keys(mapData[0]).join(',');
    const rows = mapData.map(row => Object.values(row).join(',')).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'correlation_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const topCorrelation = mapData.length > 0 ? [...mapData].sort((a, b) => b.correlation_score - a.correlation_score)[0] : null;
  const avgCorrelation = mapData.length > 0 ? mapData.reduce((acc, c) => acc + c.correlation_score, 0) / mapData.length : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        right={
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">Ministry Official</p>
            <p className="text-xs text-muted-foreground">Admin Access</p>
          </div>
        }
      />
      <div className="flex-grow flex">
        {/* Filters Sidebar */}
        <aside className="w-1/4 bg-card p-6 border-r space-y-4">
          <h2 className="text-xl font-semibold flex items-center"><Filter className="h-5 w-5 mr-2" />Filters</h2>
          
          <Card>
            <CardHeader><CardTitle className="text-base">Date Range</CardTitle></CardHeader>
            <CardContent>
              <DateRangePicker
                date={date}
                onDateChange={setDate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Categories</CardTitle></CardHeader>
            <CardContent>
                <MultiSelect
                    options={categoryOptions}
                    selected={selectedCategories}
                    onChange={setSelectedCategories}
                    placeholder="Select categories..."
                />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">City</CardTitle></CardHeader>
            <CardContent>
              <Input
                placeholder="Filter by city..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
              />
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="w-3/4 flex flex-col">
          {/* Stats Cards */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Highest Correlation Pair</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{topCorrelation ? `${topCorrelation.category_a} & ${topCorrelation.category_b}` : 'N/A'}</p>
                <p className="text-xs text-muted-foreground">{topCorrelation ? `in ${topCorrelation.city || 'N/A'}` : ''}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Highest Score</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{topCorrelation ? topCorrelation.correlation_score.toFixed(2) : 'N/A'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Avg. Correlation</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{avgCorrelation.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Map Area */}
          <div className="flex-grow p-6 relative">
            <div className="absolute top-8 right-8 z-10">
                <Button onClick={handleExport} disabled={mapData.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                </Button>
            </div>
            <MinistryMap filters={filters} onDataLoad={setMapData} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MinistryDashboard;
