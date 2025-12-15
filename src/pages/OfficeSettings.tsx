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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Lokasi Kantor</h1>
              <p className="text-muted-foreground mt-1">Kelola lokasi dan koordinat GPS kantor untuk validasi absensi</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addLocation}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Lokasi
            </Button>
            <Button onClick={saveLocations} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Simpan
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Peta Lokasi
              </CardTitle>
              <CardDescription>
                {selectedLocation 
                  ? "Klik pada peta untuk mengubah posisi lokasi yang dipilih" 
                  : "Pilih lokasi di panel kanan untuk mengubah posisinya"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                ref={mapContainer} 
                className="w-full h-[400px] rounded-lg border"
                style={{ minHeight: '400px' }}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
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
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="h-5 w-5" />
                      <Input
                        value={location.name}
                        onChange={(e) => updateLocation(location.id, 'name', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-0 p-0 h-auto text-lg font-semibold focus-visible:ring-0"
                      />
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {selectedLocation === location.id && (
                        <Badge variant="secondary">Dipilih</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
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
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Latitude</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={location.latitude}
                        onChange={(e) => updateLocation(location.id, 'latitude', parseFloat(e.target.value) || 0)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Longitude</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={location.longitude}
                        onChange={(e) => updateLocation(location.id, 'longitude', parseFloat(e.target.value) || 0)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Radius Validasi (meter)</Label>
                    <Input
                      type="number"
                      value={location.radius}
                      onChange={(e) => updateLocation(location.id, 'radius', parseInt(e.target.value) || 100)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      getCurrentLocation(location.id);
                    }}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Gunakan Lokasi Saat Ini
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Petunjuk Penggunaan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. <strong>Tambah Lokasi:</strong> Klik tombol "Tambah Lokasi" untuk menambah lokasi kantor baru.</p>
            <p>2. <strong>Edit Koordinat:</strong> Pilih kartu lokasi, lalu klik pada peta untuk mengubah posisi, atau gunakan tombol "Gunakan Lokasi Saat Ini".</p>
            <p>3. <strong>Radius Validasi:</strong> Tentukan jarak maksimal (dalam meter) karyawan dapat melakukan absensi dari titik lokasi.</p>
            <p>4. <strong>Simpan:</strong> Jangan lupa klik "Simpan" setelah melakukan perubahan.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
