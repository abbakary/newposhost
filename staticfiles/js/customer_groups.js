document.addEventListener('DOMContentLoaded', function () {
  const content = document.getElementById('customerGroupsContent');
  const form = document.getElementById('cgFilters');

  function serializeForm(frm) {
    const fd = new FormData(frm);
    const usp = new URLSearchParams();
    for (const [k, v] of fd.entries()) usp.append(k, v);
    return usp.toString();
  }

  function smoothReplace(html) {
    if (!content) return;
    content.style.transition = 'opacity 150ms ease';
    content.style.opacity = '0.4';
    setTimeout(function () {
      content.innerHTML = html;
      content.style.opacity = '1';
      reinitEnhancements();
    }, 150);
  }

  async function ajaxLoad(url, push = true) {
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set('ajax', '1');
      const res = await fetch(u.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      if (data && data.html) {
        smoothReplace(data.html);
        if (push) history.pushState({}, '', url);
      }
    } catch (e) {
      window.location.href = url; // fallback
    }
  }

  function handleLinkClick(e) {
    const a = e.target.closest('[data-cg-link="true"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    e.preventDefault();
    ajaxLoad(href, true);
  }

  function reinitEnhancements() {
    if (window.bootstrap) {
      var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function (tooltipTriggerEl) { return new bootstrap.Tooltip(tooltipTriggerEl); });
    }
    if (window.jQuery) {
      try {
        if ($.fn.DataTable && $.fn.DataTable.isDataTable('#cgTable')) {
          $('#cgTable').DataTable().destroy();
        }
      } catch (e) {}
      if ($('#cgTable').length && $.fn.DataTable) {
        $('#cgTable').DataTable({
          pageLength: 10,
          order: [[5, 'desc']],
          responsive: true,
          dom: "<div class='row'><'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
               "<div class='row'><'col-sm-12'tr>>" +
               "<div class='row'><'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
          language: { search: "", searchPlaceholder: "Search customers...", lengthMenu: "Show _MENU_ entries", info: "Showing _START_ to _END_ of _TOTAL_ entries", paginate: { previous: "<i class='fas fa-chevron-left'></i>", next: "<i class='fas fa-chevron-right'></i>" } },
          initComplete: function () { $('.dataTables_filter input').addClass('form-control'); $('.dataTables_length select').addClass('form-select'); }
        });
      }
    }
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const qs = serializeForm(form);
      const url = form.getAttribute('action') + (qs ? ('?' + qs) : '');
      ajaxLoad(url, true);
    });
  }

  document.addEventListener('click', handleLinkClick);

  if (content && !window.__cgPopstateBound) {
    window.addEventListener('popstate', function () {
      if (document.getElementById('customerGroupsContent')) {
        ajaxLoad(window.location.href, false);
      }
    });
    window.__cgPopstateBound = true;
  }

  reinitEnhancements();
});
