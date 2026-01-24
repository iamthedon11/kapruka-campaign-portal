// ═══════════════════════════════════════════════════════════════
// SUPABASE API CLIENT - KAPRUKA CAMPAIGN PORTAL (UPDATED)
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://ivllhheqqiseagmctfyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2bGxoaGVxcWlzZWFnbWN0ZnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NzQzMzksImV4cCI6MjA4NDE1MDMzOX0.OnkYNACtdknKDY2KqLfiGN0ORXpKaW906fD0TtSJlIk';
const ADMIN_PASSWORD = 'Kapruka2026!Admin';
const CONTENT_HEAD_PASSWORD = '207';

const VALID_STATUSES = ['Request Submitted', 'Working', 'Live', 'Completed', 'Rejected'];
const STUDIO_APPROVAL_STATUSES = ['Received', 'Working', 'Submitted for Review', 'Approved'];

// ═══════════════════════════════════════════════════════════════
// PAGE SCHEDULE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const PAGE_SCHEDULE = {
  'Kapruka FB Leads': { day: 1, slots: 3 },      // Monday
  'Electronic Factory': { day: 2, slots: 3 },    // Tuesday (was Wednesday)
  'Social Mart': { day: 3, slots: 3 },          // Wednesday (was Tuesday)
  'Fashion Factory': { day: 4, slots: 3 },       // Thursday
  'Toys Factory': { day: 5, slots: 3 },         // Friday
  'Handbag Factory': { day: 6, slots: 3 },      // Saturday
  'TikTok Video': { day: 0, slots: 1 }          // Sunday (weekly)
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function supabaseQuery(endpoint, method = 'GET', body = null) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

function getCurrentMonth() {
  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function getAllPageNames() {
  return Object.keys(PAGE_SCHEDULE);
}

function verifyContentHeadPassword(password) {
  return password === CONTENT_HEAD_PASSWORD;
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT SUGGESTION SLOT AVAILABILITY (NEXT 2 WEEKS)
// ═══════════════════════════════════════════════════════════════

async function getAvailableSlotsForPage(pageName) {
  try {
    if (!PAGE_SCHEDULE[pageName]) {
      throw new Error(`Invalid page name: ${pageName}`);
    }

    const schedule = PAGE_SCHEDULE[pageName];
    const targetDay = schedule.day;
    const slotsPerDay = schedule.slots;

    // Get dates for next 2 weeks for this specific weekday
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find next occurrence of the target day
    let currentDate = new Date(today);
    const daysUntilTarget = (targetDay - currentDate.getDay() + 7) % 7;
    if (daysUntilTarget === 0) {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setDate(currentDate.getDate() + daysUntilTarget);
    }

    // Get next 2 occurrences
    for (let i = 0; i < 2; i++) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Get existing product bookings
    const productBookings = await supabaseQuery(
      `product_suggestions?assigned_page=eq.${encodeURIComponent(pageName)}&status=eq.Approved`
    );

    // Build slot availability
    const slotAvailability = [];

    dates.forEach(date => {
      for (let slotNum = 1; slotNum <= slotsPerDay; slotNum++) {
        const productBooked = productBookings.find(p => 
          p.go_live_date === date && 
          p.assigned_slot_number === slotNum
        );

        const isBooked = !!productBooked;

        slotAvailability.push({
          date: date,
          slotNumber: slotNum,
          available: !isBooked,
          bookedBy: productBooked ? `${productBooked.submission_id}` : null,
          displayLabel: `${date} - Slot ${slotNum}`
        });
      }
    });

    return {
      pageName: pageName,
      weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][targetDay],
      slots: slotAvailability.filter(s => s.available)
    };
  } catch (error) {
    console.error('getAvailableSlotsForPage error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// NEW STUDIO CALENDAR - VERTICAL VIEW WITH ALL SLOTS
// ═══════════════════════════════════════════════════════════════

async function getStudioCalendarVertical(startDate, endDate) {
  try {
    // Get all studio slots
    const slots = await supabaseQuery(
      `studio_calendar_slots?date=gte.${startDate}&date=lte.${endDate}&order=date.desc`
    );

    // Get content calendar bookings
    const contentBookings = await supabaseQuery(
      `content_calendar?date=gte.${startDate}&date=lte.${endDate}`
    );

    // Get product suggestions
    const productSuggestions = await supabaseQuery(
      `product_suggestions?go_live_date=gte.${startDate}&go_live_date=lte.${endDate}&status=eq.Approved`
    );

    // Get studio calendar details
    const studioDetails = await supabaseQuery(
      `studio_calendar?date=gte.${startDate}&date=lte.${endDate}`
    );

    // Group slots by date
    const dateGroups = {};

    slots.forEach(slot => {
      if (!dateGroups[slot.date]) {
        dateGroups[slot.date] = {
          date: slot.date,
          dayOfWeek: new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
          slots: []
        };
      }

      let slotData = {
        id: slot.id,
        slotNumber: slot.slot_number,
        slotType: slot.slot_type,
        pageName: slot.page_name,
        category: slot.category,
        theme: slot.theme,
        bookingStatus: 'empty',
        userBooked: false,
        adminApproved: false,
        studioStatus: 'Received',
        productCode: null,
        productLink: null,
        submittedBy: null,
        contentLink: null,
        approvedBy: null,
        studioId: null
      };

      // Check content calendar booking
      if (slot.slot_type === 'content_calendar') {
        const booking = contentBookings.find(b => 
          b.date === slot.date && 
          b.slot_number === slot.slot_number
        );

        if (booking) {
          slotData.userBooked = true;
          slotData.adminApproved = booking.status === 'Approved';
          slotData.bookingStatus = booking.status === 'Approved' ? 'approved' : 'pending';
          slotData.productCode = booking.product_code;
          slotData.productLink = booking.product_link;
          slotData.submittedBy = booking.submitted_by;
        }
      }

      // Check product suggestion
      if (slot.slot_type === 'product_suggestion') {
        const product = productSuggestions.find(p => 
          p.go_live_date === slot.date && 
          p.assigned_slot_number === slot.slot_number &&
          p.assigned_page === slot.page_name
        );

        if (product) {
          slotData.userBooked = true;
          slotData.adminApproved = true;
          slotData.bookingStatus = 'approved';
          slotData.productCode = product.submission_id;
          slotData.productLink = product.product_link;
          slotData.submittedBy = product.name;
        }
      }

      // Check studio details
      const studioDetail = studioDetails.find(s =>
        s.date === slot.date &&
        s.slot_number === slot.slot_number &&
        s.slot_type === slot.slot_type
      );

      if (studioDetail) {
        slotData.studioStatus = studioDetail.approval_status || 'Received';
        slotData.contentLink = studioDetail.content_link;
        slotData.approvedBy = studioDetail.approved_by;
        slotData.studioId = studioDetail.id;
      }

      dateGroups[slot.date].slots.push(slotData);
    });

    // Convert to array and sort
    const result = Object.values(dateGroups).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    // Sort slots within each date
    result.forEach(day => {
      day.slots.sort((a, b) => {
        if (a.slotType === b.slotType) {
          return a.slotNumber - b.slotNumber;
        }
        return a.slotType === 'content_calendar' ? -1 : 1;
      });
    });

    return result;
  } catch (error) {
    console.error('getStudioCalendarVertical error:', error);
    throw error;
  }
}

async function getStudioCalendarStats(startDate, endDate) {
  try {
    const data = await getStudioCalendarVertical(startDate, endDate);
    
    let stats = {
      totalSlots: 0,
      emptySlots: 0,
      pendingApproval: 0,
      approved: 0,
      needsReview: 0,
      contentHeadApproved: 0
    };

    data.forEach(day => {
      day.slots.forEach(slot => {
        stats.totalSlots++;
        
        if (slot.bookingStatus === 'empty') {
          stats.emptySlots++;
        } else if (slot.bookingStatus === 'pending') {
          stats.pendingApproval++;
        } else if (slot.bookingStatus === 'approved') {
          stats.approved++;
        }

        if (slot.studioStatus === 'Submitted for Review') {
          stats.needsReview++;
        }
        
        if (slot.studioStatus === 'Approved') {
          stats.contentHeadApproved++;
        }
      });
    });

    return stats;
  } catch (error) {
    console.error('getStudioCalendarStats error:', error);
    return {
      totalSlots: 0,
      emptySlots: 0,
      pendingApproval: 0,
      approved: 0,
      needsReview: 0,
      contentHeadApproved: 0
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE STUDIO CALENDAR APPROVAL STATUS
// ═══════════════════════════════════════════════════════════════

async function updateStudioApprovalStatus(date, slotNumber, slotType, statusData) {
  try {
    // Validate status
    if (!STUDIO_APPROVAL_STATUSES.includes(statusData.approvalStatus)) {
      throw new Error(`Invalid approval status: ${statusData.approvalStatus}`);
    }

    // Check if entry exists
    const existing = await supabaseQuery(
      `studio_calendar?date=eq.${date}&slot_number=eq.${slotNumber}&slot_type=eq.${slotType}`
    );

    const updateData = {
      approval_status: statusData.approvalStatus,
      updated_at: new Date().toISOString()
    };

    // If Submitted for Review, require content link
    if (statusData.approvalStatus === 'Submitted for Review') {
      if (!statusData.contentLink) {
        throw new Error('Content link is required for submission');
      }
      updateData.content_link = statusData.contentLink;
    }

    // If Approved, require password and approver name
    if (statusData.approvalStatus === 'Approved') {
      if (!verifyContentHeadPassword(statusData.password)) {
        throw new Error('Invalid content head password');
      }
      if (!statusData.approvedBy) {
        throw new Error('Approver name is required');
      }
      updateData.approved_by = statusData.approvedBy;
      updateData.approved_at = new Date().toISOString();
    }

    if (existing.length > 0) {
      // Update existing
      await supabaseQuery(
        `studio_calendar?id=eq.${existing[0].id}`,
        'PATCH',
        updateData
      );
      return { success: true, id: existing[0].id };
    } else {
      // Create new entry
      const newData = {
        date: date,
        slot_number: slotNumber,
        slot_type: slotType,
        ...updateData
      };
      const result = await supabaseQuery('studio_calendar', 'POST', newData);
      return { success: true, id: result[0].id };
    }
  } catch (error) {
    console.error('updateStudioApprovalStatus error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// STUDIO CALENDAR LEGACY FUNCTIONS (UPDATED)
// ═══════════════════════════════════════════════════════════════

async function getStudioCalendarForMonth(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  return await getStudioCalendarVertical(startDate, endDate);
}

async function getStudioCalendarItem(id) {
  const rows = await supabaseQuery(`studio_calendar?id=eq.${id}`);
  return rows.length ? rows[0] : null;
}

async function updateStudioCompletion(id, data) {
  const payload = {
    completion_status: data.completion_status,
    content_link: data.content_link || null
  };
  await supabaseQuery(`studio_calendar?id=eq.${id}`, 'PATCH', payload);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN BOOKING API
// ═══════════════════════════════════════════════════════════════

async function getInitialData() {
  const configs = await supabaseQuery('department_config?active=eq.Yes&select=month');
  const months = [...new Set(configs.map(c => c.month))];
  const currentMonth = getCurrentMonth();

  return {
    months: months.length > 0 ? months : [currentMonth],
    currentMonth: months.includes(currentMonth) ? currentMonth : (months[0] || currentMonth)
  };
}

async function getSlotsForMonth(month) {
  const configs = await supabaseQuery(`department_config?month=eq.${encodeURIComponent(month)}&active=eq.Yes`);

  if (configs.length === 0) return [];

  const requests = await supabaseQuery(`request_log?month=eq.${encodeURIComponent(month)}`);

  return configs.map(dept => {
    const slots = [];
    const bookedSlots = {};

    requests.forEach(req => {
      if (req.department === dept.department && 
          req.status && 
          req.status !== 'Rejected' &&
          req.status !== 'Completed') {
        bookedSlots[req.slot] = {
          requestId: req.request_id,
          campaign: req.campaign || 'N/A',
          status: req.status,
          requestor: req.name,
          startDate: req.start_date || 'N/A',
          endDate: req.end_date || 'N/A'
        };
      }
    });

    for (let i = 1; i <= dept.slots; i++) {
      const slotName = `Slot ${i}`;
      slots.push({
        number: i,
        name: slotName,
        available: !bookedSlots[slotName],
        details: bookedSlots[slotName] || null
      });
    }

    return {
      department: dept.department,
      budget: dept.budget,
      totalSlots: dept.slots,
      color: dept.color,
      slots: slots
    };
  });
}

async function submitCampaignRequest(formData) {
  const existing = await supabaseQuery(
    `request_log?department=eq.${encodeURIComponent(formData.department)}&month=eq.${encodeURIComponent(formData.month)}&slot=eq.${encodeURIComponent(formData.slot)}`
  );

  const alreadyBooked = existing.some(req => 
    req.status && 
    req.status !== 'Rejected' && 
    req.status !== 'Completed'
  );

  if (alreadyBooked) {
    throw new Error('This slot is already booked');
  }

  const requestData = {
    request_id: generateId('REQ'),
    email: 'user@kapruka.lk',
    name: formData.name || 'User',
    department: formData.department,
    month: formData.month,
    slot: formData.slot,
    campaign: formData.campaign,
    duration: formData.duration,
    start_date: formData.startDate,
    end_date: formData.endDate,
    status: 'Request Submitted'
  };

  const result = await supabaseQuery('request_log', 'POST', requestData);
  return { success: true, requestId: result[0].request_id };
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT SUGGESTION API
// ═══════════════════════════════════════════════════════════════

async function getActiveWindow() {
  const windows = await supabaseQuery('submission_windows?status=eq.Active&order=created_at.desc&limit=1');

  if (windows.length === 0) {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 3);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 4);

    const newWindow = {
      window_id: generateId('WIN'),
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      target_suggestions: 30,
      status: 'Active'
    };

    const result = await supabaseQuery('submission_windows', 'POST', newWindow);
    return result[0];
  }

  return windows[0];
}

async function getProductDashboard() {
  try {
    const window = await getActiveWindow();

    if (!window) {
      return { window: null, target: 30, actual: 0, picked: 0, categories: [], rejections: [] };
    }

    const products = await supabaseQuery(
      `product_suggestions?timestamp=gte.${window.start_date}T00:00:00&timestamp=lte.${window.end_date}T23:59:59`
    );

    const categoryCount = {};
    const rejections = [];
    let picked = 0;

    products.forEach(p => {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
      if (p.status === 'Approved') picked++;
      if (p.status === 'Rejected') {
        rejections.push({
          productName: p.product_link.split('/').pop().replace(/-/g, ' ').substring(0, 40),
          reason: p.rejection_reason || 'Not specified'
        });
      }
    });

    const categories = Object.keys(categoryCount).map(cat => ({
      category: cat,
      count: categoryCount[cat]
    })).sort((a, b) => b.count - a.count);

    return {
      window: window,
      target: window.target_suggestions,
      actual: products.length,
      picked: picked,
      categories: categories,
      rejections: rejections.slice(0, 5)
    };
  } catch (error) {
    console.error('getProductDashboard error:', error);
    return { window: null, target: 30, actual: 0, picked: 0, categories: [], rejections: [] };
  }
}

async function submitProductSuggestion(formData) {
  const window = await getActiveWindow();

  if (!window) {
    throw new Error('No active submission window');
  }

  const submissionData = {
    submission_id: generateId('SUB'),
    email: 'user@kapruka.lk',
    name: formData.name || 'User',
    product_link: formData.productLink,
    product_type: formData.productType || '',
    category: formData.category,
    margin: parseFloat(formData.margin),
    promotion_idea: formData.promotionIdea || '',
    available_qty: parseInt(formData.availableQty),
    status: 'Pending'
  };

  const result = await supabaseQuery('product_suggestions', 'POST', submissionData);
  return { success: true, submissionId: result[0].submission_id };
}

async function searchProductSuggestions(query) {
  const products = await supabaseQuery('product_suggestions?order=timestamp.desc');
  const searchLower = query.toLowerCase();

  return products.filter(p => 
    p.product_link.toLowerCase().includes(searchLower) ||
    p.category.toLowerCase().includes(searchLower) ||
    p.submission_id.toLowerCase().includes(searchLower)
  ).slice(0, 20);
}

// ═══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD API
// ═══════════════════════════════════════════════════════════════

function verifyAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}

async function getAllRequests() {
  const requests = await supabaseQuery('request_log?order=timestamp.desc');
  return requests.map(r => ({
    row: r.id,
    requestId: r.request_id,
    timestamp: r.timestamp,
    email: r.email,
    name: r.name,
    department: r.department,
    month: r.month,
    slot: r.slot,
    campaign: r.campaign,
    duration: r.duration,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    reviewer: r.reviewer || '',
    updated: r.updated_at,
    comments: r.comments || ''
  }));
}

async function updateRequestStatus(row, status, reviewer, comments) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}. Valid statuses are: ${VALID_STATUSES.join(', ')}`);
  }

  const updateData = {
    status,
    reviewer,
    updated_at: new Date().toISOString(),
    comments
  };

  if (status === 'Completed') {
    updateData.completed_at = new Date().toISOString();
  }

  await supabaseQuery(
    `request_log?id=eq.${row}`,
    'PATCH',
    updateData
  );

  return { success: true };
}

async function getAllProductSuggestions() {
  const products = await supabaseQuery('product_suggestions?order=timestamp.desc');
  return products.map(p => ({
    row: p.id,
    submissionId: p.submission_id,
    timestamp: p.timestamp,
    email: p.email,
    name: p.name,
    productLink: p.product_link,
    productType: p.product_type,
    category: p.category,
    margin: p.margin,
    promotionIdea: p.promotion_idea,
    availableQty: p.available_qty,
    status: p.status,
    assignedPage: p.assigned_page || '',
    goLiveDate: p.go_live_date || '',
    slotNumber: p.assigned_slot_number || null,
    reviewerName: p.reviewer_name || '',
    rejectionReason: p.rejection_reason || ''
  }));
}

async function updateProductReview(row, reviewData) {
  try {
    const updateData = {
      status: reviewData.status,
      reviewer_name: reviewData.reviewerName
    };

    if (reviewData.status === 'Approved') {
      updateData.assigned_page = reviewData.assignedPage || '';
      updateData.go_live_date = reviewData.goLiveDate || null;
      updateData.assigned_slot_number = reviewData.slotNumber || null;
      updateData.rejection_reason = '';
    } else {
      updateData.assigned_page = '';
      updateData.go_live_date = null;
      updateData.assigned_slot_number = null;
      updateData.rejection_reason = reviewData.rejectionReason || '';
    }

    await supabaseQuery(`product_suggestions?id=eq.${row}`, 'PATCH', updateData);

    // Create studio calendar entry if approved
    if (reviewData.status === 'Approved') {
      const rows = await supabaseQuery(`product_suggestions?id=eq.${row}`);
      if (rows.length) {
        const p = rows[0];

        // Check if studio calendar entry exists
        const existing = await supabaseQuery(
          `studio_calendar?date=eq.${reviewData.goLiveDate}&slot_number=eq.${reviewData.slotNumber}&slot_type=eq.product_suggestion`
        );

        const studioData = {
          date: reviewData.goLiveDate,
          slot_number: reviewData.slotNumber,
          slot_type: 'product_suggestion',
          page_name: reviewData.assignedPage,
          product_code: p.submission_id,
          content_details: p.promotion_idea || p.product_link,
          reference_links: p.product_link,
          approval_status: 'Received'
        };

        if (existing.length > 0) {
          await supabaseQuery(`studio_calendar?id=eq.${existing[0].id}`, 'PATCH', studioData);
        } else {
          await supabaseQuery('studio_calendar', 'POST', studioData);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('updateProductReview error:', error);
    throw error;
  }
}

async function getAllDepartments() {
  const configs = await supabaseQuery('department_config?order=id.asc');
  return configs.map(c => ({
    row: c.id,
    month: c.month,
    department: c.department,
    budget: c.budget,
    slots: c.slots,
    color: c.color,
    active: c.active
  }));
}

async function addDepartment(config) {
  await supabaseQuery('department_config', 'POST', {
    month: config.month,
    department: config.department,
    budget: parseFloat(config.budget),
    slots: parseInt(config.slots),
    color: config.color || '#E8F5E9',
    active: config.active || 'Yes'
  });
  return { success: true };
}

async function deleteDepartment(row) {
  await supabaseQuery(`department_config?id=eq.${row}`, 'DELETE');
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// CONTENT CALENDAR API
// ═══════════════════════════════════════════════════════════════

const CATEGORIES = [
  'Cakes', 'Flowers', 'Chocolates', 'Clothing', 'Electronics', 'Fashion',
  'Food & Restaurants', 'Fruits', 'Soft Toys & Kids Toys', 'Grocery & Hampers',
  'Greeting Cards & Party Supplies', 'Sports and Bicycles', 'Mother and Baby',
  'Jewellery and Watches', 'Cosmetics & Perfumes', 'Customized Gifts',
  'Health and Wellness', 'Home & Lifestyle', 'Combo and Gift Sets', 'Books & Stationery'
];

async function getCalendarData(month, year) {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const themes = await supabaseQuery(
      `theme_config?start_date=lte.${endDate}&end_date=gte.${startDate}`
    );

    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    const categorySlots = await supabaseQuery(
      `category_slots?month_year=eq.${monthYear}`
    );

    const bookings = await supabaseQuery(
      `content_calendar?date=gte.${startDate}&date=lte.${endDate}`
    );

    return {
      themes: themes,
      categorySlots: categorySlots,
      bookings: bookings
    };
  } catch (error) {
    console.error('getCalendarData error:', error);
    return { themes: [], categorySlots: [], bookings: [] };
  }
}

async function getThemeForDate(date) {
  try {
    const themes = await supabaseQuery(
      `theme_config?start_date=lte.${date}&end_date=gte.${date}`
    );
    return themes.length > 0 ? themes[0] : null;
  } catch (error) {
    console.error('getThemeForDate error:', error);
    return null;
  }
}

async function getCategorySlotsForDate(date) {
  try {
    const slots = await supabaseQuery(
      `category_slots?date=eq.${date}&order=slot_number.asc`
    );
    return slots;
  } catch (error) {
    console.error('getCategorySlotsForDate error:', error);
    return [];
  }
}

async function submitContentBooking(bookingData) {
  try {
    const existing = await supabaseQuery(
      `content_calendar?date=eq.${bookingData.date}&slot_number=eq.${bookingData.slotNumber}`
    );

    const alreadyBooked = existing.some(b => b.status === 'Pending' || b.status === 'Approved');

    if (alreadyBooked) {
      throw new Error('This slot is already booked');
    }

    const themes = await supabaseQuery(
      `theme_config?start_date=lte.${bookingData.date}&end_date=gte.${bookingData.date}`
    );

    const themeName = themes.length > 0 ? themes[0].theme_name : 'Daily Post';

    const booking = {
      date: bookingData.date,
      slot_number: parseInt(bookingData.slotNumber),
      category: bookingData.category,
      product_code: bookingData.productCode,
      product_link: bookingData.productLink || '',
      status: 'Pending',
      submitted_by: bookingData.submittedBy || 'User',
      theme: themeName
    };

    const result = await supabaseQuery('content_calendar', 'POST', booking);
    return { success: true, bookingId: result[0].id };
  } catch (error) {
    console.error('submitContentBooking error:', error);
    throw error;
  }
}

async function getAllContentBookings() {
  try {
    const bookings = await supabaseQuery('content_calendar?order=date.desc,slot_number.asc');
    return bookings.map(b => ({
      id: b.id,
      date: b.date,
      slotNumber: b.slot_number,
      category: b.category,
      productCode: b.product_code,
      productLink: b.product_link,
      status: b.status,
      submittedBy: b.submitted_by,
      theme: b.theme,
      pageName: b.page_name,
      scheduleDate: b.schedule_date,
      goLiveDate: b.go_live_date,
      reviewer: b.reviewer,
      rejectionReason: b.rejection_reason,
      createdAt: b.created_at
    }));
  } catch (error) {
    console.error('getAllContentBookings error:', error);
    return [];
  }
}

async function updateContentBooking(id, updateData) {
  try {
    const data = {
      status: updateData.status,
      reviewer: updateData.reviewer,
      updated_at: new Date().toISOString()
    };

    if (updateData.status === 'Approved') {
      data.go_live_date = updateData.goLiveDate || null;
    } else if (updateData.status === 'Rejected') {
      data.rejection_reason = updateData.rejectionReason || '';
    }

    await supabaseQuery(`content_calendar?id=eq.${id}`, 'PATCH', data);

    // Create studio calendar entry if approved
    if (updateData.status === 'Approved') {
      const rows = await supabaseQuery(`content_calendar?id=eq.${id}`);
      if (rows.length) {
        const b = rows[0];

        const existing = await supabaseQuery(
          `studio_calendar?date=eq.${b.date}&slot_number=eq.${b.slot_number}&slot_type=eq.content_calendar`
        );

        const studioData = {
          date: b.date,
          slot_number: b.slot_number,
          slot_type: 'content_calendar',
          category: b.category,
          theme: b.theme,
          product_code: b.product_code,
          content_details: `${b.theme || ''} - ${b.category || ''}`.trim(),
          reference_links: b.product_link || '',
          approval_status: 'Received'
        };

        if (existing.length > 0) {
          await supabaseQuery(`studio_calendar?id=eq.${existing[0].id}`, 'PATCH', studioData);
        } else {
          await supabaseQuery('studio_calendar', 'POST', studioData);
        }
      }
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
}

async function getAllThemes() {
  try {
    const themes = await supabaseQuery('theme_config?order=start_date.desc');
    return themes;
  } catch (error) {
    console.error('getAllThemes error:', error);
    return [];
  }
}

async function addTheme(themeData) {
  try {
    const theme = {
      theme_name: themeData.themeName,
      start_date: themeData.startDate,
      end_date: themeData.endDate,
      slots_per_day: parseInt(themeData.slotsPerDay),
      theme_color: themeData.themeColor || '#422B73',
      is_seasonal: themeData.isSeasonal || false
    };

    const result = await supabaseQuery('theme_config', 'POST', theme);

    await generateCategorySlots(
      themeData.startDate, 
      themeData.endDate, 
      themeData.slotsPerDay,
      themeData.isSeasonal
    );

    return { success: true, themeId: result[0].id };
  } catch (error) {
    throw error;
  }
}

async function generateCategorySlots(startDate, endDate, slotsPerDay, isSeasonal = false) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const slots = [];

    const categoriesToUse = isSeasonal 
      ? ['Any Category']
      : [...CATEGORIES].sort(() => Math.random() - 0.5);

    let categoryIndex = 0;

    let currentDate = new Date(start);
    let weekNumber = Math.floor((currentDate.getDate() - 1) / 7) + 1;

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const monthYear = dateStr.substring(0, 7);

      if (!isSeasonal && currentDate.getDay() === 0 && currentDate > start) {
        categoriesToUse.sort(() => Math.random() - 0.5);
        categoryIndex = 0;
        weekNumber++;
      }

      for (let slotNum = 1; slotNum <= slotsPerDay; slotNum++) {
        slots.push({
          date: dateStr,
          slot_number: slotNum,
          category: categoriesToUse[categoryIndex % categoriesToUse.length],
          week_number: weekNumber,
          month_year: monthYear
        });
        categoryIndex++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (slots.length > 0) {
      await supabaseQuery('category_slots', 'POST', slots);
    }

    return { success: true, slotsCreated: slots.length };
  } catch (error) {
    console.error('generateCategorySlots error:', error);
    throw error;
  }
}

async function deleteTheme(themeId) {
  try {
    const themes = await supabaseQuery(`theme_config?id=eq.${themeId}`);
    if (themes.length === 0) throw new Error('Theme not found');

    const theme = themes[0];

    const slots = await supabaseQuery(
      `category_slots?date=gte.${theme.start_date}&date=lte.${theme.end_date}`
    );

    if (slots.length > 0) {
      await supabaseQuery(
        `category_slots?date=gte.${theme.start_date}&date=lte.${theme.end_date}`,
        'DELETE'
      );
    }

    await supabaseQuery(`theme_config?id=eq.${themeId}`, 'DELETE');

    return { success: true, slotsDeleted: slots.length };
  } catch (error) {
    console.error('deleteTheme error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// HOT PRODUCTS API
// ═══════════════════════════════════════════════════════════════

async function getHotProductsByCategory(category) {
  try {
    const products = await supabaseQuery(
      `hot_products?category=eq.${encodeURIComponent(category)}&order=created_at.desc`
    );
    return products;
  } catch (error) {
    console.error('getHotProductsByCategory error:', error);
    throw error;
  }
}

async function getAllHotProducts() {
  try {
    const products = await supabaseQuery('hot_products?order=created_at.desc');
    return products;
  } catch (error) {
    console.error('getAllHotProducts error:', error);
    throw error;
  }
}

async function addHotProduct(productData) {
  try {
    const data = {
      category: productData.category,
      product_link: productData.productLink,
      sales_count: parseInt(productData.salesCount) || 0,
      listed: false,
      kapruka_link: null
    };

    const result = await supabaseQuery('hot_products', 'POST', data);
    return { success: true, product: result[0] };
  } catch (error) {
    console.error('addHotProduct error:', error);
    throw error;
  }
}

async function updateHotProduct(productId, updateData) {
  try {
    const data = {};

    if (updateData.listed !== undefined) {
      data.listed = updateData.listed;
    }

    if (updateData.kapruka_link !== undefined) {
      data.kapruka_link = updateData.kapruka_link || null;
    }

    if (updateData.salesCount !== undefined) {
      data.sales_count = parseInt(updateData.salesCount) || 0;
    }

    await supabaseQuery(`hot_products?id=eq.${productId}`, 'PATCH', data);
    return { success: true };
  } catch (error) {
    console.error('updateHotProduct error:', error);
    throw error;
  }
}

async function deleteHotProduct(productId) {
  try {
    await supabaseQuery(`hot_products?id=eq.${productId}`, 'DELETE');
    return { success: true };
  } catch (error) {
    console.error('deleteHotProduct error:', error);
    throw error;
  }
}

async function getHotProductsStats() {
  try {
    const products = await supabaseQuery('hot_products');

    const stats = {
      totalProducts: products.length,
      listedProducts: products.filter(p => p.listed).length,
      byCategory: {}
    };

    products.forEach(p => {
      if (!stats.byCategory[p.category]) {
        stats.byCategory[p.category] = {
          total: 0,
          listed: 0,
          totalSales: 0
        };
      }
      stats.byCategory[p.category].total++;
      if (p.listed) stats.byCategory[p.category].listed++;
      stats.byCategory[p.category].totalSales += (p.sales_count || 0);
    });

    return stats;
  } catch (error) {
    console.error('getHotProductsStats error:', error);
    throw error;
  }
}
