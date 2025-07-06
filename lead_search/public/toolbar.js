frappe.provide('frappe.ui.form');

let custom_search_interval = null;

function addSearchBar() {
    if (!window.location.pathname.includes('/app/lead')) return;
    if ($('#custom-navbar-search').length) return;

    let $container = $('.page-actions').first();
    if (!$container.length) $container = $('.standard-actions').first();
    if (!$container.length) $container = $('.list-toolbar').first();
    if (!$container.length) return;

    $container.prepend(`
        <div id="custom-search-wrapper" class="frappe-control" style="display:inline-block; margin-right: 12px;">
            <div class="input-group" style="width: 260px;">
                <input id="custom-navbar-search" type="text"
                    class="form-control"
                    placeholder="Search Leads..."
                    style="height: 32px; font-size: 13px; border-radius: var(--border-radius-sm, 4px) 0 0 var(--border-radius-sm, 4px); background: var(--control-bg, #fff);"
                    autocomplete="off"
                >
                <span class="input-group-btn">
                    <button class="btn btn-default" id="custom-search-btn"
                        style="height: 32px; border-radius: 0 var(--border-radius-sm, 4px) var(--border-radius-sm, 4px) 0; border-left: none; background: var(--btn-bg, #f8f9fa); color: var(--text-muted, #6c757d);">
                        <i class="fa fa-search"></i>
                    </button>
                </span>
            </div>
        </div>
    `);

    $('#custom-navbar-search').on('keypress', function(e) {
        if (e.which === 13) dynamicdays($(this).val().trim());
    });

    $('#custom-search-btn').on('click', function() {
        dynamicdays($('#custom-navbar-search').val().trim());
    });

    $('#custom-navbar-search').on('keydown', function(e) {
        if (e.which === 27) $(this).val('').blur();
    });
}

function dynamicdays(query) {
    if (!query) return;
    
    $('#custom-search-btn').html('<i class="fa fa-spinner fa-spin"></i>');
    
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Days for Lead Search",
            fieldname: "days"
        },
        callback: function(r) {
            let days = (r.message && r.message.days) ? r.message.days : 90;
            console.log("days for search:", days);
            performSearch(query, days);
        },
        error: function() {
            performSearch(query, 90);
        }
    });
}

function performSearch(query, days) {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Lead",
            filters: [["Lead", "creation", ">=", frappe.datetime.add_days(frappe.datetime.now_date(), -days)]],
            or_filters: [
                ["Lead", "phone", "like", `%${query}%`],
                ["Lead", "mobile_no", "like", `%${query}%`],
                ["Lead", "lead_name", "like", `%${query}%`]
            ],
            fields: ["name", "lead_name", "phone", "mobile_no", "creation", "status"],
            limit: 15,
            order_by: "creation desc"
        },
        callback: function(r) {
            $('#custom-search-btn').html('<i class="fa fa-search"></i>');
            r.message && r.message.length ? showResults(r.message, query) : 
                frappe.msgprint({title: 'No Results', message: `No leads found matching "${query}"`, indicator: 'orange'});
        },
        error: function() {
            $('#custom-search-btn').html('<i class="fa fa-search"></i>');
            frappe.msgprint({title: 'Error', message: 'Search failed', indicator: 'red'});
        }
    });
}

function showResults(leads, term) {
    let html = `<div><p class="text-muted">Found ${leads.length} lead(s) matching "<b>${frappe.utils.escape_html(term)}</b>"</p>`;

    leads.forEach(lead => {
        let phone = lead.phone || lead.mobile_no || '';
        let color = lead.status === 'Converted' ? 'success' : lead.status === 'Lost' ? 'danger' : 'info';

        html += `
            <div class="lead-item" data-name="${lead.name}" 
                 style="padding: 10px 14px; border: 1px solid #ececec; margin: 6px 0; cursor: pointer; 
                        border-radius: 5px; background: #fcfcfc; transition: box-shadow 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${frappe.utils.escape_html(lead.lead_name)}</strong>
                        <span class="label label-${color}" style="margin-left: 8px; font-size: 0.8em;">
                            ${frappe.utils.escape_html(lead.status || 'Open')}
                        </span>
                    </div>
                    <small style="color: #8d99a6;">
                        ${frappe.datetime.str_to_user(lead.creation)}
                    </small>
                </div>
                <div style="margin-top: 4px; color: #666;">
                    <i class="fa fa-phone" style="margin-right: 5px;"></i>${frappe.utils.escape_html(phone)}
                </div>
            </div>
        `;
    });
    
    const previouslyFocused = document.activeElement;

    let d = new frappe.ui.Dialog({
        title: 'Search Results',
        fields: [{fieldtype: 'HTML', fieldname: 'results', options: html + '</div>'}],
        primary_action_label: 'Close',
        primary_action() { 
            d.hide();
            if (previouslyFocused && typeof previouslyFocused.focus === "function") {
                previouslyFocused.focus();
            }
        }
    });

    d.$wrapper.on('click', '.lead-item', function() {
        $('#custom-navbar-search').val('');
        frappe.set_route('Form', 'Lead', $(this).data('name'));
        d.hide();
        if (previouslyFocused && typeof previouslyFocused.focus === "function") {
            previouslyFocused.focus();
        }
    });

    d.show();
    setTimeout(() => {
        document.querySelectorAll('body > *').forEach(el => {
            if (!el.contains(d.$wrapper[0])) {
                el.setAttribute('inert', '');
            }
        });
        d.$wrapper.attr('tabindex', '-1').focus();
    }, 10);

    d.onhide = function() {
        document.querySelectorAll('[inert]').forEach(el => el.removeAttribute('inert'));
    };
}

function clearSearchOnListView() {
    if (window.location.pathname.includes('/app/lead')) {
        $('#custom-navbar-search').val('');
    }
}

function startSearchBarInterval() {
    if (custom_search_interval) {
        clearInterval(custom_search_interval);
    }
    
    custom_search_interval = setInterval(function() {
        if (window.location.pathname.includes('/app/lead')) {
            addSearchBar();
            if ($('#custom-navbar-search').length) {
                clearInterval(custom_search_interval);
                custom_search_interval = null;
            }
        } else {
            clearInterval(custom_search_interval);
            custom_search_interval = null;
        }
    }, 100);
}

$(document).on('page-change', function() {
    if (!window.location.pathname.includes('/app/lead')) {
        $('#custom-search-wrapper').remove();
        if (custom_search_interval) {
            clearInterval(custom_search_interval);
            custom_search_interval = null;
        }
    } else {
        startSearchBarInterval();
    }
    clearSearchOnListView();
});

$(document).ready(function() {
    if (window.location.pathname.includes('/app/lead')) {
        startSearchBarInterval();
    }
});
