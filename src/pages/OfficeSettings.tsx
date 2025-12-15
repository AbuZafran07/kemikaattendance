import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Plus, Trash2, Save, Loader2, Navigation, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export default function OfficeSettings() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchMapboxToken();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (mapboxToken && mapContainer.current && !map.current) {
      initializeMap();
    }
  }, [mapboxToken]);

  useEffect(() => {
    if (map.current) {
      updateMapMarkers();
    }
  }, [locations, selectedLocation]);

  const fetchMapboxToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;
      setMapboxToken(data.token);
    } catch (error) {
      console.error('Error fetching Mapbox token:', error);
      toast({
        title: "Error",
        description: "Gagal memuat peta. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'office_locations')
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        const parsedLocations = Array.isArray(data.value) ? (data.value as unknown as OfficeLocation[]) : [];
        setLocations(parsedLocations);
      } else {
        setLocations([
          {
            id: crypto.randomUUID(),
            name: "Kantor Pusat",
            latitude: -6.2088,
            longitude: 106.8456,
            radius: 100
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data lokasi kantor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMap = () => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [106.8456, -6.2088],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('click', (e) => {
      if (selectedLocation) {
        const { lng, lat } = e.lngLat;
        setLocations(prev => prev.map(loc => 
          loc.id === selectedLocation 
            ? { ...loc, latitude: lat, longitude: lng }
            : loc
        ));
      }
    });
  };

  const updateMapMarkers = () => {
    if (!map.current) return;

    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};

    locations.forEach(location => {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 rounded-full flex items-center justify-center cursor-pointer';
      el.style.backgroundColor = location.id === selectedLocation ? '#3b82f6' : '#ef4444';
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.longitude, location.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>${location.name}</strong><br/>Radius: ${location.radius}m`))
        .addTo(map.current!);

      markers.current[location.id] = marker;
    });

    if (locations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach(loc => bounds.extend([loc.longitude, loc.latitude]));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  };

  const addLocation = () => {
    const newLocation: OfficeLocation = {
      id: crypto.randomUUID(),
      name: `Kantor ${locations.length + 1}`,
      latitude: -6.2088,
      longitude: 106.8456,
      radius: 100
    };
    setLocations([...locations, newLocation]);
    setSelectedLocation(newLocation.id);
  };

  const removeLocation = (id: string) => {
    if (locations.length <= 1) {
      toast({
        title: "Peringatan",
        description: "Minimal harus ada satu lokasi kantor",
        variant: "destructive",
      });
      return;
    }
    setLocations(locations.filter(loc => loc.id !== id));
    if (selectedLocation === id) {
      setSelectedLocation(null);
    }
  };

  const updateLocation = (id: string, field: keyof OfficeLocation, value: string | number) => {
    setLocations(prev => prev.map(loc => 
      loc.id === id ? { ...loc, [field]: value } : loc
    ));
  };

  const saveLocations = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'office_locations')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: JSON.parse(JSON.stringify(locations)), updated_at: new Date().toISOString() })
          .eq('key', 'office_locations');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert([{
            key: 'office_locations',
            value: JSON.parse(JSON.stringify(locations)),
            description: 'Daftar lokasi kantor untuk validasi GPS absensi'
          }]);
        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: "Lokasi kantor berhasil disimpan",
      });
    } catch (error) {
      console.error('Error saving locations:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan lokasi kantor",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getCurrentLocation = (locationId: string) => {
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Browser tidak mendukung geolokasi",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocations(prev => prev.map(loc => 
          loc.id === locationId 
            ? { ...loc, latitude, longitude }
            : loc
        ));
        
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 16
          });
        }
        
        toast({
          title: "Berhasil",
          description: "Koordinat berhasil diperbarui dari lokasi Anda saat ini",
        });
      },
      () => {
        toast({
          title: "Error",
          description: "Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan.",
          variant: "destructive",
        });
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/dashboard/settings")}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Lokasi Kantor</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Kelola lokasi dan koordinat GPS kantor</p>
            </div>
          </div>
          <div className="flex gap-2 ml-10 sm:ml-0">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={addLocation}>
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Tambah
            </Button>
            <Button size="sm" className="text-xs sm:text-sm" onClick={saveLocations} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" /> : <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />}
              Simpan
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card className="lg:row-span-2">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Peta Lokasi
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {selectedLocation 
                  ? "Klik pada peta untuk mengubah posisi lokasi yang dipilih" 
                  : "Pilih lokasi di panel kanan untuk mengubah posisinya"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div 
                ref={mapContainer} 
                className="w-full h-[250px] sm:h-[400px] rounded-lg border"
                style={{ minHeight: '250px' }}
              />
            </CardContent>
          </Card>

          <div className="space-y-3 sm:space-y-4">
            {locations.map((location) => (
              <Card 
                key={location.id}
                className={`cursor-pointer transition-all ${
                  selectedLocation === location.id 
                    ? 'ring-2 ring-primary' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedLocation(
                  selectedLocation === location.id ? null : location.id
                )}
              >
                <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                      <Input
                        value={location.name}
                        onChange={(e) => updateLocation(location.id, 'name', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-0 p-0 h-auto text-sm sm:text-lg font-semibold focus-visible:ring-0 max-w-[150px] sm:max-w-none"
                      />
                    </CardTitle>
                    <div className="flex items-center gap-1 sm:gap-2">
                      {selectedLocation === location.id && (
                        <Badge variant="secondary" className="text-xs px-1.5 sm:px-2">Dipilih</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLocation(location.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-4 pt-0 sm:pt-0">
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Latitude</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={location.latitude}
                        onChange={(e) => updateLocation(location.id, 'latitude', parseFloat(e.target.value) || 0)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs sm:text-sm h-8 sm:h-10"
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Longitude</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={location.longitude}
                        onChange={(e) => updateLocation(location.id, 'longitude', parseFloat(e.target.value) || 0)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs sm:text-sm h-8 sm:h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Radius Validasi (meter)</Label>
                    <Input
                      type="number"
                      value={location.radius}
                      onChange={(e) => updateLocation(location.id, 'radius', parseInt(e.target.value) || 100)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs sm:text-sm h-8 sm:h-10"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs sm:text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      getCurrentLocation(location.id);
                    }}
                  >
                    <Navigation className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Gunakan Lokasi Saat Ini
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Petunjuk Penggunaan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs sm:text-sm text-muted-foreground p-4 sm:p-6 pt-0 sm:pt-0">
            <p>1. <strong>Tambah Lokasi:</strong> Klik tombol "Tambah" untuk menambah lokasi kantor baru.</p>
            <p>2. <strong>Edit Koordinat:</strong> Pilih kartu lokasi, lalu klik pada peta untuk mengubah posisi.</p>
            <p>3. <strong>Radius Validasi:</strong> Tentukan jarak maksimal (dalam meter) karyawan dapat melakukan absensi.</p>
            <p>4. <strong>Simpan:</strong> Jangan lupa klik "Simpan" setelah melakukan perubahan.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
