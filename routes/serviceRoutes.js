const verifyAdmin = require('../middlewares/verifyAdmin');
const Service = require('../models/Service');

// ১. সব সার্ভিস দেখা (অ্যাডমিনের জন্য - Active এবং Inactive দুটোই)
router.get('/admin/services', verifyAdmin, async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ২. সার্ভিস ডিলিট করা
router.delete('/admin/services/:id', verifyAdmin, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ৩. সার্ভিসের স্ট্যাটাস চেঞ্জ করা (Active <-> Inactive)
router.patch('/admin/services/:id/toggle', verifyAdmin, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Not found' });
    
    service.status = service.status === 'active' ? 'inactive' : 'active';
    await service.save();
    
    res.json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});