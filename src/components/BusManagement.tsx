import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { BusRoute } from '@/lib/types';
import { Bus, MapPin, User, Phone, Plus, Edit2, Check, X, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BusManagement = ({ studentId }: { studentId?: string }) => {
  const { schoolId, role } = useAuth();
  const { busRoutes, students, addBusRoute, updateBusRoute, loading } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isAdmin = role === 'admin';

  if (loading.busRoutes) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const routes = role === 'parent' || role === 'student'
    ? busRoutes.filter(r => studentId && r.assignedStudents.includes(studentId))
    : busRoutes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground text-lg">Bus Transport</h3>
        {isAdmin && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            Add Route
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Routes" value={busRoutes.length} icon={Bus} />
        <SummaryCard label="Active" value={busRoutes.filter(r => r.status === 'Active').length} icon={Check} />
        <SummaryCard label="Students Covered" value={busRoutes.reduce((s, r) => s + r.assignedStudents.length, 0)} icon={User} />
        <SummaryCard label="Total Capacity" value={busRoutes.reduce((s, r) => s + r.capacity, 0)} icon={MapPin} />
      </div>

      {showAddForm && <AddRouteForm schoolId={schoolId} addBusRoute={addBusRoute} onClose={() => setShowAddForm(false)} />}

      <div className="space-y-4">
        {routes.map(route => (
          <RouteCard
            key={route.id}
            route={route}
            isAdmin={isAdmin}
            isEditing={editingId === route.id}
            onEdit={() => setEditingId(editingId === route.id ? null : route.id)}
            schoolId={schoolId}
            updateBusRoute={updateBusRoute}
          />
        ))}
        {routes.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Bus className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No bus routes assigned</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) => (
  <div className="bg-card rounded-xl border border-border p-4 text-center">
    <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
    <div className="text-xl font-bold text-foreground">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

const RouteCard = ({ route, isAdmin, isEditing, onEdit, schoolId, updateBusRoute }: { route: BusRoute; isAdmin: boolean; isEditing: boolean; onEdit: () => void; schoolId: string; updateBusRoute: any }) => {
  const { students } = useStore();
  const [status, setStatus] = useState(route.status);
  const assignedStudentNames = route.assignedStudents.map(id => students.find(s => s.id === id)?.name || id);

  const handleStatusChange = async (newStatus: BusRoute['status']) => {
    setStatus(newStatus);
    await updateBusRoute(schoolId, route.id, { status: newStatus });
    toast.success(`Route ${route.routeNumber} status updated to ${newStatus}`);
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-foreground">{route.routeName}</h4>
              <p className="text-xs text-muted-foreground">{route.routeNumber} · {route.vehicleNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${status === 'Active' ? 'bg-success/10 text-success' :
              status === 'Maintenance' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
              }`}>
              {status}
            </span>
            {isAdmin && (
              <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Driver Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">{route.driverName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">{route.driverContact}</span>
          </div>
        </div>

        {/* Stops */}
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Route Stops</h5>
          <div className="flex items-center gap-1 overflow-x-auto">
            {route.stops.sort((a, b) => a.order - b.order).map((stop, i) => (
              <div key={i} className="flex items-center gap-1 flex-shrink-0">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <div className="text-center mt-1">
                    <p className="text-xs font-medium text-foreground whitespace-nowrap">{stop.name}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{stop.time}</p>
                  </div>
                </div>
                {i < route.stops.length - 1 && <div className="w-8 h-0.5 bg-border mt-[-16px]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Assigned Students */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase">Assigned Students ({route.assignedStudents.length}/{route.capacity})</h5>
            {route.assignedStudents.length >= route.capacity && (
              <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3 h-3" /> Full</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {assignedStudentNames.map((name, i) => (
              <span key={i} className="px-2 py-1 bg-muted/50 rounded-md text-xs text-foreground">{name}</span>
            ))}
            {route.assignedStudents.length === 0 && <span className="text-xs text-muted-foreground">No students assigned</span>}
          </div>
        </div>

        {/* Admin Status Controls */}
        {isAdmin && isEditing && (
          <div className="mt-4 pt-4 border-t border-border">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Change Status</h5>
            <div className="flex gap-2">
              {(['Active', 'Inactive', 'Maintenance'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AddRouteForm = ({ schoolId, addBusRoute, onClose }: { schoolId: string; addBusRoute: any; onClose: () => void }) => {
  const [form, setForm] = useState({
    routeName: '', routeNumber: '', driverName: '', driverContact: '',
    vehicleNumber: '', capacity: '40', stops: '', stopTimes: '',
  });

  // Build structured stops: pair stop names with their times
  const buildStops = () => {
    const names = form.stops.split(',').map(s => s.trim()).filter(Boolean);
    const times = form.stopTimes.split(',').map(t => t.trim());
    return names.map((name, i) => ({ name, time: times[i] || '', order: i + 1 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.routeName || !form.driverName) { toast.error('Fill required fields'); return; }
    const newRoute: BusRoute = {
      id: `BR${Date.now()}`, routeName: form.routeName, routeNumber: form.routeNumber,
      driverName: form.driverName, driverContact: form.driverContact,
      vehicleNumber: form.vehicleNumber, capacity: parseInt(form.capacity) || 40,
      assignedStudents: [],
      stops: buildStops(),
      status: 'Active',
    };
    await addBusRoute(schoolId, newRoute);
    toast.success('Route added!');
    onClose();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display font-semibold text-foreground">Add New Route</h4>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-md"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormInput label="Route Name *" value={form.routeName} onChange={v => setForm({ ...form, routeName: v })} />
        <FormInput label="Route Number" value={form.routeNumber} onChange={v => setForm({ ...form, routeNumber: v })} placeholder="e.g. R-04" />
        <FormInput label="Driver Name *" value={form.driverName} onChange={v => setForm({ ...form, driverName: v })} />
        <FormInput label="Driver Contact" value={form.driverContact} onChange={v => setForm({ ...form, driverContact: v })} />
        <FormInput label="Vehicle Number" value={form.vehicleNumber} onChange={v => setForm({ ...form, vehicleNumber: v })} />
        <FormInput label="Capacity" type="number" value={form.capacity} onChange={v => setForm({ ...form, capacity: v })} />
        <div className="md:col-span-2">
          <FormInput label="Stops (comma-separated)" value={form.stops} onChange={v => setForm({ ...form, stops: v })} placeholder="Stop 1, Stop 2, School Gate" />
        </div>
        <div className="md:col-span-2">
          <FormInput label="Stop Times (comma-separated, same order as stops)" value={form.stopTimes} onChange={v => setForm({ ...form, stopTimes: v })} placeholder="07:00, 07:20, 07:45" />
          <p className="text-xs text-muted-foreground mt-1">Enter one time per stop in the same order. Leave blank if not known.</p>
        </div>
        <div className="md:col-span-2">
          <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Check className="w-4 h-4" /> Add Route
          </button>
        </div>
      </form>
    </div>
  );
};

const FormInput = ({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <div>
    <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
  </div>
);

export default BusManagement;
